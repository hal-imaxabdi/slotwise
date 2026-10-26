from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import User, UserSession


def make_session_user(db):
    user = User(email="sess@example.com", password_hash="x", full_name="Sess User")
    db.add(user)
    db.flush()
    return user


def make_session(user_id, **overrides):
    now = datetime.now(UTC)
    values = {
        "user_id": user_id,
        "token_hash": "a" * 64,
        "csrf_token": "c" * 43,
        "created_at": now,
        "expires_at": now + timedelta(hours=1),
    }
    values.update(overrides)
    return UserSession(**values)


def expect_violation(db, obj, constraint):
    db.add(obj)
    with pytest.raises(IntegrityError) as exc:
        db.flush()
    assert constraint in str(exc.value)
    db.rollback()


def test_valid_session_is_accepted(db):
    user = make_session_user(db)
    db.add(make_session(user.id))
    db.flush()


def test_duplicate_token_hash_rejected(db):
    user = make_session_user(db)
    db.add(make_session(user.id))
    db.flush()
    expect_violation(db, make_session(user.id), "uq_user_sessions_token_hash")


def test_token_hash_must_be_64_hex_chars(db):
    user = make_session_user(db)
    expect_violation(
        db, make_session(user.id, token_hash="NOT-A-HASH"), "ck_user_sessions_token_hash_format"
    )


def test_expiry_must_be_after_creation(db):
    user = make_session_user(db)
    now = datetime.now(UTC)
    expect_violation(
        db,
        make_session(user.id, created_at=now, expires_at=now),
        "ck_user_sessions_expires_after_created",
    )


def test_user_with_session_cannot_be_deleted(db):
    user = make_session_user(db)
    db.add(make_session(user.id))
    db.flush()
    db.delete(user)
    with pytest.raises(IntegrityError) as exc:
        db.flush()
    assert "fk_user_sessions_user_id_users" in str(exc.value)
    db.rollback()
    