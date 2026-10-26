from datetime import UTC, datetime

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, UserSession
from app.sessions import get_valid_session


def get_now() -> datetime:
    return datetime.now(UTC)


def get_current_session(
    token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
) -> tuple[UserSession, User]:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    found = get_valid_session(db, token, now=now)
    if found is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return found
