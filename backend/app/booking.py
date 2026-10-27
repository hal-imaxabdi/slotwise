"""Booking service: cross-table rules the database cannot enforce.

Flushes only; the caller (router) commits.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.availability import BUSINESS_TZ, get_free_slots
from app.models import Appointment, Service, User
from app.models.appointment import AppointmentStatus

EXCLUSION_VIOLATION = "23P01"


class BookingError(Exception):
    """Base class for booking rule violations."""


class SlotTaken(BookingError):
    """Another active appointment occupies this time (maps to 409)."""


class SlotNotBookable(BookingError):
    """Outside business hours, blocked, in the past or off the grid (maps to 422)."""


def _sqlstate(exc: IntegrityError) -> str | None:
    orig = exc.orig
    return getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None)


def _overlaps_active_appointment(db: Session, starts_at: datetime, ends_at: datetime) -> bool:
    found = db.scalars(
        select(Appointment.id)
        .where(
            Appointment.status != AppointmentStatus.CANCELLED.value,
            Appointment.starts_at < ends_at,
            Appointment.ends_at > starts_at,
        )
        .limit(1)
    ).first()
    return found is not None


def create_appointment(
    db: Session,
    *,
    user: User,
    service_id: uuid.UUID,
    starts_at: datetime,
    notes: str,
    now: datetime,
) -> Appointment:
    """Book `service_id` at `starts_at` for `user`.

    Raises ServiceNotFound (unknown or inactive service), SlotTaken, SlotNotBookable.
    """
    starts_at = starts_at.astimezone(timezone.utc)
    local_day = starts_at.astimezone(BUSINESS_TZ).date()

    free = get_free_slots(db, service_id, local_day, now=now)  # may raise ServiceNotFound
    service = db.get(Service, service_id)
    assert service is not None  # get_free_slots just loaded it
    ends_at = starts_at + timedelta(minutes=service.duration_minutes)

    if starts_at not in free:
        if _overlaps_active_appointment(db, starts_at, ends_at):
            raise SlotTaken()
        raise SlotNotBookable()

    appointment = Appointment(
        customer_id=user.id,
        service_id=service.id,
        starts_at=starts_at,
        ends_at=ends_at,
        notes=notes,
        created_by_id=user.id,
    )
    try:
        with db.begin_nested():  # savepoint: a conflict leaves the outer transaction usable
            db.add(appointment)
            db.flush()
    except IntegrityError as exc:
        if _sqlstate(exc) == EXCLUSION_VIOLATION:
            raise SlotTaken() from exc
        raise
    return appointment
