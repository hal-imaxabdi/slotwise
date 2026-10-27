"""Admin-only management of the service catalog.

Deactivating a service hides it from the public catalog and stops new bookings
(get_free_slots rejects inactive services). Existing appointments are untouched.
Flushes only; the caller (router) commits.
"""

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.booking import BookingError, BookingForbidden
from app.dbutil import sqlstate
from app.models import Role, Service, User

UNIQUE_VIOLATION = "23505"
MAX_NAME_LENGTH = 120
MAX_DESCRIPTION_LENGTH = 2000
GRID_MINUTES = 30
MAX_DURATION_MINUTES = 480
MAX_PRICE_IDR = 2_147_483_647  # PostgreSQL integer maximum
EDITABLE_FIELDS = frozenset({"name", "description", "duration_minutes", "price_idr"})


class InvalidService(BookingError):
    """A field value is out of range (maps to 422). str(exc) is a safe message."""


class ServiceNameTaken(BookingError):
    """Another service already has this name, ignoring case (maps to 409)."""


class UnknownService(BookingError):
    """No service with this id, active or not (maps to 404)."""


def _raise_if_name_taken(exc: IntegrityError) -> None:
    if sqlstate(exc) == UNIQUE_VIOLATION:
        raise ServiceNameTaken() from exc


def _require_admin(user: User) -> None:
    if user.role != Role.ADMIN.value:
        raise BookingForbidden()


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _validate(changes: dict[str, Any]) -> dict[str, Any]:
    """Return cleaned values for the given fields only. Raises InvalidService."""
    unknown = set(changes) - EDITABLE_FIELDS
    if unknown:
        raise ValueError(f"unknown fields: {sorted(unknown)}")

    clean: dict[str, Any] = {}
    if "name" in changes:
        name = changes["name"]
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= MAX_NAME_LENGTH:
            raise InvalidService(f"name must be 1-{MAX_NAME_LENGTH} characters")
        clean["name"] = name.strip()
    if "description" in changes:
        description = changes["description"]
        if not isinstance(description, str) or len(description.strip()) > MAX_DESCRIPTION_LENGTH:
            raise InvalidService(f"description must be at most {MAX_DESCRIPTION_LENGTH} characters")
        clean["description"] = description.strip()
    if "duration_minutes" in changes:
        duration = changes["duration_minutes"]
        if (
            not _is_int(duration)
            or duration <= 0
            or duration > MAX_DURATION_MINUTES
            or duration % GRID_MINUTES != 0
        ):
            raise InvalidService(
                f"duration_minutes must be a multiple of {GRID_MINUTES} "
                f"between {GRID_MINUTES} and {MAX_DURATION_MINUTES}"
            )
        clean["duration_minutes"] = duration
    if "price_idr" in changes:
        price = changes["price_idr"]
        if not _is_int(price) or price < 0 or price > MAX_PRICE_IDR:
            raise InvalidService(f"price_idr must be between 0 and {MAX_PRICE_IDR}")
        clean["price_idr"] = price
    return clean


def _name_taken(db: Session, name: str, exclude_id: uuid.UUID | None = None) -> bool:
    query = (
        select(func.count())
        .select_from(Service)
        .where(func.lower(Service.name) == name.lower())
    )
    if exclude_id is not None:
        query = query.where(Service.id != exclude_id)
    return bool(db.scalar(query))


def _load_for_update(db: Session, service_id: uuid.UUID) -> Service:
    service = db.scalar(
        select(Service)
        .where(Service.id == service_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if service is None:
        raise UnknownService()
    return service


def create_service(
    db: Session,
    *,
    user: User,
    name: str,
    duration_minutes: int,
    description: str = "",
    price_idr: int = 0,
) -> Service:
    """Create an active service (admin only).

    Raises BookingForbidden, InvalidService, ServiceNameTaken.
    """
    _require_admin(user)
    values = _validate(
        {
            "name": name,
            "description": description,
            "duration_minutes": duration_minutes,
            "price_idr": price_idr,
        }
    )
    if _name_taken(db, values["name"]):
        raise ServiceNameTaken()

    service = Service(**values, is_active=True)
    try:
        with db.begin_nested():  # savepoint: a lost race leaves the transaction usable
            db.add(service)
            db.flush()
    except IntegrityError as exc:
        _raise_if_name_taken(exc)
        raise
    return service


def update_service(
    db: Session, *, user: User, service_id: uuid.UUID, changes: dict[str, Any]
) -> Service:
    """Apply only the given fields (admin only). Empty `changes` is a no-op.

    Raises BookingForbidden, InvalidService, UnknownService, ServiceNameTaken.
    Unknown field names raise ValueError (a programming error, not user input).
    """
    _require_admin(user)
    values = _validate(changes)
    service = _load_for_update(db, service_id)
    if not values:
        return service
    if "name" in values and _name_taken(db, values["name"], exclude_id=service.id):
        raise ServiceNameTaken()

    try:
        with db.begin_nested():
            for field, value in values.items():
                setattr(service, field, value)
            db.flush()
    except IntegrityError as exc:
        _raise_if_name_taken(exc)
        raise
    return service


def set_active(
    db: Session, *, user: User, service_id: uuid.UUID, active: bool
) -> Service:
    """Activate or deactivate a service (admin only). Idempotent.

    Raises BookingForbidden, UnknownService.
    """
    _require_admin(user)
    service = _load_for_update(db, service_id)
    if service.is_active != active:
        service.is_active = active
        db.flush()
    return service


def list_services(db: Session, *, active: bool | None = None) -> list[Service]:
    """All services by name (case-insensitive); optionally only active or inactive."""
    query = select(Service)
    if active is not None:
        query = query.where(Service.is_active.is_(active))
    return list(db.scalars(query.order_by(func.lower(Service.name), Service.id)))
