from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Role, User
from app.security.passwords import hash_password

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 128
MAX_EMAIL_LENGTH = 254
MAX_NAME_LENGTH = 100


class UserAdminError(Exception):
    """A user-facing validation problem (safe to print)."""


def normalize_email(email: str) -> str:
    value = email.strip().lower()
    if (
        not value
        or len(value) > MAX_EMAIL_LENGTH
        or value.count("@") != 1
        or any(ch.isspace() for ch in value)
        or value.startswith("@")
        or value.endswith("@")
    ):
        raise UserAdminError("invalid email address")
    return value


def create_user(db: Session, email: str, full_name: str, role: str, password: str) -> User:
    """Validate, then add the user and flush. The caller commits."""
    email = normalize_email(email)
    full_name = full_name.strip()
    if not full_name or len(full_name) > MAX_NAME_LENGTH:
        raise UserAdminError(f"name must be 1-{MAX_NAME_LENGTH} characters")
    if role not in {r.value for r in Role}:
        raise UserAdminError("role must be one of: " + ", ".join(r.value for r in Role))
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        raise UserAdminError(
            f"password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters"
        )
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise UserAdminError("a user with this email already exists")

    user = User(
        email=email,
        full_name=full_name,
        role=role,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.flush()
    return user
