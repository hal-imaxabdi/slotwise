from datetime import UTC, datetime, timedelta

from app.config import settings
from app.models import User, UserSession
from app.sessions import (
    create_session,
    get_valid_session,
    hash_token,
    revoke_all_for_user,
    revoke_session,
)
from sqlalchemy import select

NOW = datetime(2026, 11, 2, 3, 0, tzinfo=UTC)


def make_user(db, email="s@example.com", is_active=True):
    user = User(email=email, password_hash="x", full_name="S User", is_active=is_active)
    db.add(user)
    db.flush()
    return user


def test_create_stores_only_the_hash(db):
    user = make_user(db)
    new = create_session(db, user.id, now=NOW)
    row = db.execute(select(UserSession)).scalar_one()
    assert row.token_hash == hash_token(new.token)
    assert row.token_hash != new.token
    assert row.csrf_token == new.csrf_token
    assert new.expires_at == NOW + timedelta(hours=settings.session_ttl_hours)


def test_tokens_are_unique_and_long(db):
    user = make_user(db)
    a = create_session(db, user.id, now=NOW)
    b = create_session(db, user.id, now=NOW)
    assert a.token != b.token
    assert a.csrf_token != b.csrf_token
    assert len(a.token) >= 43


def test_valid_token_returns_session_and_user(db):
    user = make_user(db)
    new = create_session(db, user.id, now=NOW)
    found = get_valid_session(db, new.token, now=NOW + timedelta(minutes=1))
    assert found is not None
    session, found_user = found
    assert found_user.id == user.id
    assert session.csrf_token == new.csrf_token


def test_unknown_token_returns_none(db):
    assert get_valid_session(db, "no-such-token", now=NOW) is None


def test_expired_session_returns_none(db):
    user = make_user(db)
    new = create_session(db, user.id, now=NOW)
    just_before = new.expires_at - timedelta(seconds=1)
    assert get_valid_session(db, new.token, now=just_before) is not None
    assert get_valid_session(db, new.token, now=new.expires_at) is None


def test_revoked_session_returns_none(db):
    user = make_user(db)
    new = create_session(db, user.id, now=NOW)
    revoke_session(db, new.token, now=NOW)
    assert get_valid_session(db, new.token, now=NOW) is None


def test_revoke_is_idempotent(db):
    user = make_user(db)
    new = create_session(db, user.id, now=NOW)
    revoke_session(db, new.token, now=NOW)
    revoke_session(db, new.token, now=NOW + timedelta(hours=1))
    revoke_session(db, "unknown-token", now=NOW)


def test_inactive_user_session_returns_none(db):
    user = make_user(db)
    new = create_session(db, user.id, now=NOW)
    user.is_active = False
    db.flush()
    assert get_valid_session(db, new.token, now=NOW) is None


def test_revoke_all_only_affects_that_user(db):
    u1 = make_user(db, "one@example.com")
    u2 = make_user(db, "two@example.com")
    a1 = create_session(db, u1.id, now=NOW)
    a2 = create_session(db, u1.id, now=NOW)
    b = create_session(db, u2.id, now=NOW)
    assert revoke_all_for_user(db, u1.id, now=NOW) == 2
    assert get_valid_session(db, a1.token, now=NOW) is None
    assert get_valid_session(db, a2.token, now=NOW) is None
    assert get_valid_session(db, b.token, now=NOW) is not None
    