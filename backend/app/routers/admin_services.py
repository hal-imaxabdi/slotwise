"""Admin-only service management. Every route requires the admin role.

Service functions only flush; this module commits.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.admin_services import (
    InvalidService,
    ServiceNameTaken,
    UnknownService,
    create_service,
    list_services,
    set_active,
    update_service,
)
from app.booking import BookingForbidden
from app.database import get_db
from app.deps import require_admin, require_admin_write
from app.models import User, UserSession
from app.schemas import AdminServiceCreateIn, AdminServiceOut, AdminServiceUpdateIn

router = APIRouter(prefix="/admin/services", tags=["admin"])


def _http_error(exc: BookingForbidden | InvalidService | ServiceNameTaken | UnknownService):
    if isinstance(exc, InvalidService):
        return HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, ServiceNameTaken):
        return HTTPException(status_code=409, detail="A service with that name already exists")
    if isinstance(exc, UnknownService):
        return HTTPException(status_code=404, detail="Service not found")
    return HTTPException(status_code=403, detail="Forbidden")  # BookingForbidden


_HANDLED = (BookingForbidden, InvalidService, ServiceNameTaken, UnknownService)


@router.get("", response_model=list[AdminServiceOut])
def list_all(
    active: bool | None = None,
    _current: tuple[UserSession, User] = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return list_services(db, active=active)


@router.post("", status_code=201, response_model=AdminServiceOut)
def create(
    body: AdminServiceCreateIn,
    current: tuple[UserSession, User] = Depends(require_admin_write),
    db: Session = Depends(get_db),
):
    _session, user = current
    try:
        service = create_service(
            db,
            user=user,
            name=body.name,
            description=body.description,
            duration_minutes=body.duration_minutes,
            price_idr=body.price_idr,
        )
    except _HANDLED as exc:
        raise _http_error(exc) from exc
    db.commit()
    return service


@router.patch("/{service_id}", response_model=AdminServiceOut)
def update(
    service_id: uuid.UUID,
    body: AdminServiceUpdateIn,
    current: tuple[UserSession, User] = Depends(require_admin_write),
    db: Session = Depends(get_db),
):
    _session, user = current
    try:
        service = update_service(
            db,
            user=user,
            service_id=service_id,
            changes=body.model_dump(exclude_unset=True),
        )
    except _HANDLED as exc:
        raise _http_error(exc) from exc
    db.commit()
    return service


def _set_active(db: Session, user: User, service_id: uuid.UUID, active: bool):
    try:
        service = set_active(db, user=user, service_id=service_id, active=active)
    except _HANDLED as exc:
        raise _http_error(exc) from exc
    db.commit()
    return service


@router.post("/{service_id}/deactivate", response_model=AdminServiceOut)
def deactivate(
    service_id: uuid.UUID,
    current: tuple[UserSession, User] = Depends(require_admin_write),
    db: Session = Depends(get_db),
):
    _session, user = current
    return _set_active(db, user, service_id, False)


@router.post("/{service_id}/activate", response_model=AdminServiceOut)
def activate(
    service_id: uuid.UUID,
    current: tuple[UserSession, User] = Depends(require_admin_write),
    db: Session = Depends(get_db),
):
    _session, user = current
    return _set_active(db, user, service_id, True)
