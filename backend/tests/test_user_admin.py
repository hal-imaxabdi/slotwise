import pytest
from sqlalchemy import select

from app.models import User
from app.security.passwords import verify_password
from app.user_admin import UserAdminError, create_user

PW = "correct horse battery staple"


def test_creates_user_with_hashed_password(db):
    user = create_user(db, "jane@example.com", "Jane Doe", "staff", PW)
    db.commit()
    stored = db.scalar(select(User).where(User.id == user.id))
    assert stored.role == "staff"
    assert stored.is_active is True
    assert stored.password_hash != PW
    assert verify_password(PW, stored.password_hash)


def test_email_and_name_are_normalized(db):
    user = create_user(db, "  Jane@Example.COM ", "  Jane Doe  ", "customer", PW)
    assert user.email == "jane@example.com"
    assert user.full_name == "Jane Doe"


def test_duplicate_email_is_refused_ignoring_case(db):
    create_user(db, "jane@example.com", "Jane", "staff", PW)
    db.commit()
    with pytest.raises(UserAdminError, match="already exists"):
        create_user(db, "JANE@example.com", "Other Jane", "admin", PW)


def test_short_password_is_refused(db):
    with pytest.raises(UserAdminError, match="password must be"):
        create_user(db, "jane@example.com", "Jane", "staff", "short")


def test_overlong_password_is_refused(db):
    with pytest.raises(UserAdminError, match="password must be"):
        create_user(db, "jane@example.com", "Jane", "staff", "x" * 129)


@pytest.mark.parametrize("role", ["root", "", "Admin"])
def test_invalid_role_is_refused(db, role):
    with pytest.raises(UserAdminError, match="role must be"):
        create_user(db, "jane@example.com", "Jane", role, PW)


@pytest.mark.parametrize("email", ["", "nope", "a@@b.com", "a b@c.com"])
def test_invalid_email_is_refused(db, email):
    with pytest.raises(UserAdminError, match="invalid email"):
        create_user(db, email, "Jane", "staff", PW)


def test_blank_name_is_refused(db):
    with pytest.raises(UserAdminError, match="name must be"):
        create_user(db, "jane@example.com", "   ", "staff", PW)


def test_created_user_can_log_in(client, db):
    create_user(db, "jane@example.com", "Jane Doe", "staff", PW)
    db.commit()
    r = client.post("/auth/login", json={"email": "jane@example.com", "password": PW})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "staff"
    