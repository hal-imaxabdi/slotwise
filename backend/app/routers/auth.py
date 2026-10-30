from datetime import datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import throttle
from app.config import settings
from app.database import get_db
from app.deps import get_current_session, get_now, require_csrf
from app.models import User, UserSession
from app.models.user import Role
from app.schemas import AuthOut, LoginIn, RegisterIn, UserOut
from app.security.passwords import dummy_verify, hash_password, needs_rehash, verify_password
from app.sessions import (
    create_session,
    revoke_all_for_user,
    revoke_others_for_user,
    revoke_session,
)

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID = HTTPException(status_code=401, detail="Invalid email or password")


class ChangePasswordIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class ChangePasswordOut(BaseModel):
    other_sessions_revoked: int


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _too_many(wait: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail="Too many failed login attempts. Try again later.",
        headers={"Retry-After": str(wait)},
    )


def _clear_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


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
    keys = throttle.login_keys(email, _client_ip(request))

    wait = throttle.lock_remaining_seconds(db, keys, now)
    if wait:
        raise _too_many(wait)

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

    _set_session_cookie(response, new.token)
    return AuthOut(user=UserOut.model_validate(user), csrf_token=new.csrf_token)


EMAIL_TAKEN = HTTPException(status_code=409, detail="An account with this email already exists")


@router.post("/register", response_model=AuthOut, status_code=201)
def register(
    body: RegisterIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    """Public sign-up. Always creates a customer and signs the new user in.

    Every attempt counts against a per-IP limit (the existing login throttle, under a
    "register:" key), so the endpoint cannot be used to mass-create accounts or to burn
    CPU on password hashing.
    """
    keys: list[throttle.Key] = [("ip", f"register:{_client_ip(request)}")]
    wait = throttle.lock_remaining_seconds(db, keys, now)
    if wait:
        raise HTTPException(
            status_code=429,
            detail="Too many sign-up attempts. Try again later.",
            headers={"Retry-After": str(wait)},
        )
    # Commit the count BEFORE doing the work: a later rollback must not erase it.
    throttle.record_failure(db, keys, now)
    db.commit()

    if db.scalar(select(User.id).where(User.email == body.email)) is not None:
        raise EMAIL_TAKEN

    user = User(
        email=body.email,
        full_name=body.full_name,
        password_hash=hash_password(body.password),
        role=Role.CUSTOMER.value,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        # Two sign-ups with the same email at the same moment: the unique index decides.
        db.rollback()
        raise EMAIL_TAKEN from None

    new = create_session(db, user.id, now=now)
    db.commit()

    _set_session_cookie(response, new.token)
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
    _clear_cookie(response)


@router.post("/logout-all", status_code=204)
def logout_all(
    response: Response,
    current: tuple[UserSession, User] = Depends(require_csrf),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    _session, user = current
    revoke_all_for_user(db, user.id, now=now)
    db.commit()
    _clear_cookie(response)


@router.post("/password", response_model=ChangePasswordOut)
def change_password(
    body: ChangePasswordIn,
    request: Request,
    current: tuple[UserSession, User] = Depends(require_csrf),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    session, user = current
    keys = throttle.login_keys(user.email, _client_ip(request))

    # Same counters as login: a stolen session must not allow unlimited password guessing.
    wait = throttle.lock_remaining_seconds(db, keys, now)
    if wait:
        raise _too_many(wait)

    if not verify_password(body.current_password, user.password_hash):
        throttle.record_failure(db, keys, now)
        db.commit()
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if body.new_password == body.current_password:
        raise HTTPException(
            status_code=400, detail="New password must differ from the current one"
        )

    user.password_hash = hash_password(body.new_password)
    throttle.reset(db, "email", keys[0][1])
    revoked = revoke_others_for_user(db, user.id, keep_session_id=session.id, now=now)
    db.commit()
    return ChangePasswordOut(other_sessions_revoked=revoked)
