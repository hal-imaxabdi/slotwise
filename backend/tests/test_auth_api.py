from datetime import UTC, datetime

import pytest

from app.config import settings
from app.deps import get_now
from app.main import app
from app.models import User
from app.security.passwords import hash_password

NOW = datetime(2026, 11, 2, 3, 0, tzinfo=UTC)
PW = "correct horse battery staple"


@pytest.fixture()
def api(client):
    app.dependency_overrides[get_now] = lambda: NOW
    yield client
    app.dependency_overrides.pop(get_now, None)


def add_user(db, email="demo@example.com", password=PW, is_active=True):
    user = User(
        email=email, password_hash=hash_password(password), full_name="Demo", is_active=is_active
    )
    db.add(user)
    db.commit()
    return user


def login(api, email="demo@example.com", password=PW):
    return api.post("/auth/login", json={"email": email, "password": password})


def test_login_success_sets_cookie_and_returns_user(api, db):
    add_user(db)
    r = login(api)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == "demo@example.com"
    assert "password_hash" not in body["user"]
    assert len(body["csrf_token"]) >= 32
    header = r.headers["set-cookie"].lower()
    assert settings.session_cookie_name in header
    assert "httponly" in header
    assert "samesite=lax" in header
    assert "path=/" in header


def test_login_email_is_case_and_space_insensitive(api, db):
    add_user(db)
    assert login(api, email="  Demo@Example.com ").status_code == 200


def test_wrong_password_and_unknown_email_look_identical(api, db):
    add_user(db)
    wrong = login(api, password="nope")
    unknown = login(api, email="ghost@example.com")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Invalid email or password"}
    assert "set-cookie" not in wrong.headers


def test_inactive_user_cannot_login(api, db):
    add_user(db, is_active=False)
    r = login(api)
    assert r.status_code == 401
    assert r.json() == {"detail": "Invalid email or password"}


def test_seed_marker_user_cannot_login(api, db):
    user = add_user(db)
    user.password_hash = "!unusable-until-auth-milestone"
    db.commit()
    assert login(api).status_code == 401


def test_over_long_password_is_422(api, db):
    add_user(db)
    assert login(api, password="a" * 129).status_code == 422


def test_me_requires_login(api):
    assert api.get("/auth/me").status_code == 401


def test_me_after_login_returns_user_and_same_csrf(api, db):
    add_user(db)
    csrf = login(api).json()["csrf_token"]
    r = api.get("/auth/me")
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "demo@example.com"
    assert r.json()["csrf_token"] == csrf


def test_me_with_forged_cookie_is_401(api):
    api.cookies.set(settings.session_cookie_name, "forged-token")
    assert api.get("/auth/me").status_code == 401


def test_each_login_creates_a_new_session_token(api, db):
    add_user(db)
    first = login(api).json()["csrf_token"]
    second = login(api).json()["csrf_token"]
    assert first != second


def test_login_upgrades_weak_hash(api, db):
    from argon2 import PasswordHasher

    user = add_user(db)
    user.password_hash = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash(PW)
    db.commit()
    assert login(api).status_code == 200
    db.refresh(user)
    assert user.password_hash.startswith("$argon2id$")
    assert "m=65536" in user.password_hash
 


def test_logout_revokes_session_server_side(api, db):
    add_user(db)
    login(api)
    token = api.cookies.get(settings.session_cookie_name)
    assert token

    r = api.post("/auth/logout")
    assert r.status_code == 204

    # Replay the old cookie by hand: the server must reject it.
    api.cookies.clear()
    api.cookies.set(settings.session_cookie_name, token)
    assert api.get("/auth/me").status_code == 401


def test_logout_clears_cookie(api, db):
    add_user(db)
    login(api)
    header = api.post("/auth/logout").headers["set-cookie"].lower()
    assert settings.session_cookie_name in header
    assert "max-age=0" in header


def test_logout_without_cookie_is_204(api):
    assert api.post("/auth/logout").status_code == 204


def test_logout_with_forged_cookie_is_204(api):
    api.cookies.set(settings.session_cookie_name, "forged-token")
    assert api.post("/auth/logout").status_code == 204
