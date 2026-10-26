import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User, UserSession


@dataclass(frozen=True)
class NewSession:
    token: str  # raw cookie value; shown once, never stored
    csrf_token: str
    expires_at: datetime


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(db: Session, user_id: uuid.UUID, now: datetime | None = None) -> NewSession:
    now = now or datetime.now(UTC)
    token = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(hours=settings.session_ttl_hours)
    db.add(
        UserSession(
            user_id=user_id,
            token_hash=hash_token(token),
            csrf_token=csrf_token,
            created_at=now,
            expires_at=expires_at,
        )
    )
    db.flush()
    return NewSession(token=token, csrf_token=csrf_token, expires_at=expires_at)


def get_valid_session(
    db: Session, token: str, now: datetime | None = None
) -> tuple[UserSession, User] | None:
    """Return (session, user) if the token is live, else None."""
    now = now or datetime.now(UTC)
    row = db.execute(
        select(UserSession, User)
        .join(User, User.id == UserSession.user_id)
        .where(
            UserSession.token_hash == hash_token(token),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
            User.is_active.is_(True),
        )
    ).first()
    if row is None:
        return None
    return row[0], row[1]


def revoke_session(db: Session, token: str, now: datetime | None = None) -> None:
    now = now or datetime.now(UTC)
    db.execute(
        update(UserSession)
        .where(UserSession.token_hash == hash_token(token), UserSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.flush()


def revoke_all_for_user(db: Session, user_id: uuid.UUID, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    result = db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.flush()
    return result.rowcount
