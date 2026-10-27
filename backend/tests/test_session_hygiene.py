from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text

from app.config import settings
from app.deps import get_now
from app.main import app
from app.maintenance import purge_all, purge_expired_sessions, purge_stale_throttle
from app.models import User, UserSession
from app.security.passwords import hash_password, verify_password
from app.sessions import create_session, hash_token

NOW = datetime(2026, 11, 2, 3, 0, tzinfo=UTC)
PW = "correct horse battery staple"
NEW_PW = "another long passphrase 2026"
WRONG = "wrong-password-123"
EMAIL = "demo@example.com"


@pytest.fixture()
def api(client):
    app.dependency_overrides[get_now] = lambda: NOW
    yield client
    app.dependency_overrides.pop(get_now, None)


def add_user(db, email=EMAIL, password=PW):
    user = User(email=email, password_hash=hash_password(password), full_name="Demo")
    db.add(user)
    db.commit()
    return user


def login(api, password=PW):
    return api.post("/auth/login", json={"email": EMAIL, "password": password})


def login_csrf(api):
    r = login(api)
    assert r.status_code == 200
    return {"X-CSRF-Token": r.json()["csrf_token"]}


def change(api, headers, current=PW, new=NEW_PW):
    return api.post(
        "/auth/password",
        json={"current_password": current, "new_password": new},
        headers=headers,
    )


def live_count(db, user_id):
    return db.scalar(
        select(func.count())
        .select_from(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
    )


# ---------- logout everywhere ----------


def test_logout_all_revokes_own_sessions_and_clears_cookie(api, db):
    user = add_user(db)
    other = add_user(db, email="other@example.com")
    headers = login_csrf(api)
    create_session(db, user.id, now=NOW)
    create_session(db, other.id, now=NOW)
    db.commit()
    assert live_count(db, user.id) == 2

    r = api.post("/auth/logout-all", headers=headers)
    assert r.status_code == 204
    header = r.headers["set-cookie"].lower()
    assert settings.session_cookie_name in header
    assert "max-age=0" in header
    assert live_count(db, user.id) == 0
    assert live_count(db, other.id) == 1  # someone else's session is untouched
    assert api.get("/auth/me").status_code == 401


def test_logout_all_requires_csrf(api, db):
    user = add_user(db)
    login_csrf(api)
    assert api.post("/auth/logout-all").status_code == 403
    assert live_count(db, user.id) == 1


# ---------- password change ----------


def test_password_change_revokes_other_sessions_only(api, db):
    user = add_user(db)
    headers = login_csrf(api)
    create_session(db, user.id, now=NOW)
    db.commit()
    assert live_count(db, user.id) == 2

    r = change(api, headers)
    assert r.status_code == 200
    assert r.json() == {"other_sessions_revoked": 1}
    assert live_count(db, user.id) == 1
    assert api.get("/auth/me").status_code == 200  # current session survives

    db.refresh(user)
    assert verify_password(NEW_PW, user.password_hash)
    assert login(api, PW).status_code == 401
    assert login(api, NEW_PW).status_code == 200


def test_wrong_current_password_changes_nothing(api, db):
    user = add_user(db)
    headers = login_csrf(api)
    old_hash = user.password_hash
    r = change(api, headers, current=WRONG)
    assert r.status_code == 400
    assert r.json() == {"detail": "Current password is incorrect"}
    db.refresh(user)
    assert user.password_hash == old_hash


def test_new_password_must_differ(api, db):
    add_user(db)
    headers = login_csrf(api)
    r = change(api, headers, new=PW)
    assert r.status_code == 400
    assert r.json() == {"detail": "New password must differ from the current one"}


def test_new_password_too_short(api, db):
    add_user(db)
    headers = login_csrf(api)
    assert change(api, headers, new="short").status_code == 422


def test_password_change_requires_csrf(api, db):
    add_user(db)
    login_csrf(api)
    r = api.post("/auth/password", json={"current_password": PW, "new_password": NEW_PW})
    assert r.status_code == 403


def test_password_endpoint_is_throttled(api, db):
    add_user(db)
    headers = login_csrf(api)
    for _ in range(5):
        assert change(api, headers, current=WRONG).status_code == 400
    r = change(api, headers)  # correct password, but now locked
    assert r.status_code == 429
    assert r.headers["retry-after"] == "900"


# ---------- purge ----------


def make_session(db, user, label, created, expires, revoked=None):
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=hash_token(label),
            csrf_token="x" * 32,
            created_at=created,
            expires_at=expires,
            revoked_at=revoked,
        )
    )


def put_throttle(db, key, failures, window_start, locked_until=None):
    db.execute(
        text(
            "INSERT INTO login_throttle (kind, key, failures, window_start, locked_until) "
            "VALUES ('ip', :key, :f, :ws, :lu)"
        ),
        {"key": key, "f": failures, "ws": window_start, "lu": locked_until},
    )


def test_purge_expired_sessions_respects_retention(db):
    user = add_user(db)
    d = timedelta
    make_session(db, user, "old", NOW - d(days=20), NOW - d(days=10))
    make_session(db, user, "recent", NOW - d(days=9), NOW - d(days=2))
    make_session(db, user, "revoked", NOW - d(days=3), NOW + d(days=4), revoked=NOW - d(days=1))
    make_session(db, user, "live", NOW - d(hours=1), NOW + d(days=7))
    db.commit()

    assert purge_expired_sessions(db, NOW) == 1
    remaining = set(db.scalars(select(UserSession.token_hash)))
    assert remaining == {hash_token(x) for x in ("recent", "revoked", "live")}


def test_purge_stale_throttle_keeps_active_and_locked(db):
    d = timedelta
    put_throttle(db, "stale", 2, NOW - d(hours=1))
    put_throttle(db, "active", 2, NOW - d(minutes=5))
    put_throttle(db, "locked", 5, NOW - d(minutes=30), locked_until=NOW + d(minutes=5))
    put_throttle(db, "lock-over", 5, NOW - d(hours=2), locked_until=NOW - d(minutes=105))

    assert purge_stale_throttle(db, NOW) == 2
    remaining = set(db.scalars(text("SELECT key FROM login_throttle")))
    assert remaining == {"active", "locked"}


def test_purge_all_returns_counts(db):
    user = add_user(db)
    make_session(db, user, "old", NOW - timedelta(days=20), NOW - timedelta(days=10))
    put_throttle(db, "stale", 1, NOW - timedelta(hours=1))
    db.commit()
    assert purge_all(db, NOW) == (1, 1)
    