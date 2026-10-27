from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.deps import get_now
from app.main import app
from app.models import User
from app.security.passwords import hash_password

NOW = datetime(2026, 11, 2, 3, 0, tzinfo=UTC)
PW = "correct horse battery staple"
EMAIL = "demo@example.com"


@pytest.fixture()
def clock():
    box = {"now": NOW}
    app.dependency_overrides[get_now] = lambda: box["now"]
    yield box
    app.dependency_overrides.pop(get_now, None)


@pytest.fixture()
def api(client, clock):
    return client


def add_user(db, email=EMAIL, password=PW):
    user = User(email=email, password_hash=hash_password(password), full_name="Demo")
    db.add(user)
    db.commit()
    return user


def login(api, email=EMAIL, password=PW):
    return api.post("/auth/login", json={"email": email, "password": password})


def fail(api, n, email=EMAIL):
    for _ in range(n):
        assert login(api, email, "wrong-password").status_code == 401


def test_five_failures_lock_the_email(api, db):
    add_user(db)
    fail(api, 5)
    r = login(api)  # correct password, but the account is locked
    assert r.status_code == 429
    assert r.headers["retry-after"] == "900"


def test_lock_expires(api, db, clock):
    add_user(db)
    fail(api, 5)
    assert login(api).status_code == 429
    clock["now"] = NOW + timedelta(seconds=901)
    assert login(api).status_code == 200


def test_locked_attempts_do_not_extend_the_lock(api, db, clock):
    add_user(db)
    fail(api, 5)
    clock["now"] = NOW + timedelta(seconds=600)
    r = login(api)
    assert r.status_code == 429
    assert r.headers["retry-after"] == "300"


def test_success_resets_the_email_counter(api, db):
    add_user(db)
    fail(api, 4)
    assert login(api).status_code == 200
    fail(api, 4)  # would be the 8th failure without the reset
    assert login(api).status_code == 200


def test_unknown_email_is_throttled_like_a_real_one(api, db):
    add_user(db)
    fail(api, 5)
    fail(api, 5, email="ghost@example.com")
    real = login(api)
    ghost = login(api, "ghost@example.com", "x")
    assert real.status_code == ghost.status_code == 429
    assert real.json() == ghost.json()


def test_email_counter_ignores_case_and_spaces(api, db):
    add_user(db)
    for e in [" Demo@Example.com ", "DEMO@example.com", "demo@EXAMPLE.com", EMAIL, EMAIL]:
        assert login(api, e, "wrong-password").status_code == 401
    assert login(api).status_code == 429


def test_ip_limit_locks_every_email(api, db):
    add_user(db)
    for i in range(20):  # each email fails only once
        assert login(api, f"ghost{i}@example.com", "x").status_code == 401
    assert login(api).status_code == 429


def test_window_resets_after_fifteen_minutes(api, db, clock):
    add_user(db)
    fail(api, 4)
    clock["now"] = NOW + timedelta(minutes=16)
    fail(api, 4)  # fresh window: 4 failures, still below 5
    assert login(api).status_code == 200


def test_kind_check_constraint(db):
    with pytest.raises(IntegrityError) as exc:
        db.execute(
            text("INSERT INTO login_throttle (kind, key, window_start) VALUES ('x', 'k', now())")
        )
    assert "ck_login_throttle_kind" in str(exc.value)
    db.rollback()
    