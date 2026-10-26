import secrets
from datetime import UTC, datetime

from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, UserSession
from app.sessions import get_valid_session

from collections.abc import Callable

from app.models import Role


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

def require_csrf(
    current: tuple[UserSession, User] = Depends(get_current_session),
    x_csrf_token: str | None = Header(default=None),
) -> tuple[UserSession, User]:
    session, _user = current
    if not x_csrf_token or not secrets.compare_digest(
        x_csrf_token.encode("utf-8"), session.csrf_token.encode("utf-8")
    ):
        raise HTTPException(status_code=403, detail="CSRF token missing or invalid")
    return current

def _role_checker(
    base: Callable[..., tuple[UserSession, User]], allowed: frozenset[str]
) -> Callable[..., tuple[UserSession, User]]:
    def checker(current: tuple[UserSession, User] = Depends(base)) -> tuple[UserSession, User]:
        if current[1].role not in allowed:
            raise HTTPException(status_code=403, detail="Forbidden")
        return current

    return checker


STAFF_ROLES = frozenset({Role.STAFF.value, Role.ADMIN.value})
ADMIN_ROLES = frozenset({Role.ADMIN.value})

# Reads (GET): session + role.
require_staff = _role_checker(get_current_session, STAFF_ROLES)
require_admin = _role_checker(get_current_session, ADMIN_ROLES)

# Writes (POST/PUT/PATCH/DELETE): session + CSRF + role.
require_staff_write = _role_checker(require_csrf, STAFF_ROLES)
require_admin_write = _role_checker(require_csrf, ADMIN_ROLES)