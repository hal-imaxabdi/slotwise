from datetime import datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import throttle
from app.config import settings
from app.database import get_db
from app.deps import get_current_session, get_now, require_csrf
from app.models import User, UserSession
from app.schemas import AuthOut, LoginIn, UserOut
from app.security.passwords import dummy_verify, hash_password, needs_rehash, verify_password
from app.sessions import create_session, revoke_session

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID = HTTPException(status_code=401, detail="Invalid email or password")


def _fail_login(db: Session, keys: list[throttle.Key], now: datetime):
    # Commit BEFORE raising: otherwise the rollback would erase the failure count.
    throttle.record_failure(db, keys, now)
    db.commit()
    raise INVALID


@router.post("/login", response_model=AuthOut)
def login(
    body: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    email = body.email.strip().lower()
    ip = request.client.host if request.client else "unknown"
    keys = throttle.login_keys(email, ip)

    wait = throttle.lock_remaining_seconds(db, keys, now)
    if wait:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(wait)},
        )

    user = db.scalar(select(User).where(User.email == email))

    if user is None:
        dummy_verify(body.password)
        _fail_login(db, keys, now)
    if not verify_password(body.password, user.password_hash) or not user.is_active:
        _fail_login(db, keys, now)

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)

    throttle.reset(db, "email", keys[0][1])
    new = create_session(db, user.id, now=now)
    db.commit()

    response.set_cookie(
        key=settings.session_cookie_name,
        value=new.token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    return AuthOut(user=UserOut.model_validate(user), csrf_token=new.csrf_token)


@router.get("/me", response_model=AuthOut)
def me(current: tuple[UserSession, User] = Depends(get_current_session)):
    session, user = current
    return AuthOut(user=UserOut.model_validate(user), csrf_token=session.csrf_token)


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    _current: tuple[UserSession, User] = Depends(require_csrf),
    token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    revoke_session(db, token, now=now)
    db.commit()
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
    