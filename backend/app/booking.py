"""Booking service: cross-table rules the database cannot enforce.

Flushes only; the caller (router) commits.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.availability import BUSINESS_TZ, get_free_slots
from app.dbutil import sqlstate
from app.models import Appointment, Service, User
from app.models.appointment import AppointmentStatus

EXCLUSION_VIOLATION = "23P01"
STAFF_ROLES = {"staff", "admin"}
CUSTOMER_ROLE = "customer"
CUSTOMER_CHANGE_WINDOW = timedelta(hours=24)
MARKABLE_STATUSES = {AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW}


class BookingError(Exception):
    """Base class for booking rule violations."""


class SlotTaken(BookingError):
    """Another active appointment occupies this time (maps to 409)."""


class SlotNotBookable(BookingError):
    """Outside business hours, blocked, in the past or off the grid (maps to 422)."""


class AppointmentNotFound(BookingError):
    """Unknown id, or not the caller's appointment (maps to 404)."""


class ChangeWindowClosed(BookingError):
    """A customer is inside the 24h cancel/reschedule window (maps to 403)."""


class AppointmentNotActive(BookingError):
    """Only booked appointments can be changed (maps to 409)."""


class BookingForbidden(BookingError):
    """A non-staff user tried a staff-only action (maps to 403)."""


class CustomerNotFound(BookingError):
    """Unknown, inactive, or non-customer account as booking target (maps to 404)."""


class AppointmentNotStarted(BookingError):
    """An appointment that has not started yet cannot be completed or no-show (maps to 409)."""


def _overlaps_active_appointment(
    db: Session,
    starts_at: datetime,
    ends_at: datetime,
    exclude_id: uuid.UUID | None = None,
) -> bool:
    query = select(Appointment.id).where(
        Appointment.status != AppointmentStatus.CANCELLED.value,
        Appointment.starts_at < ends_at,
        Appointment.ends_at > starts_at,
    )
    if exclude_id is not None:
        query = query.where(Appointment.id != exclude_id)
    return db.scalars(query.limit(1)).first() is not None


def _load_for_update(db: Session, user: User, appointment_id: uuid.UUID) -> Appointment:
    """Lock and return the appointment. Customers only see their own."""
    appointment = db.scalars(
        select(Appointment).where(Appointment.id == appointment_id).with_for_update()
    ).first()
    if appointment is None:
        raise AppointmentNotFound()
    if user.role not in STAFF_ROLES and appointment.customer_id != user.id:
        raise AppointmentNotFound()
    return appointment


def _check_change_window(user: User, appointment: Appointment, now: datetime) -> None:
    """Customers need >= 24h before the appointment's current start. Staff are exempt."""
    if user.role in STAFF_ROLES:
        return
    if appointment.starts_at - now < CUSTOMER_CHANGE_WINDOW:
        raise ChangeWindowClosed()


def _resolve_customer(
    db: Session, user: User, customer_id: uuid.UUID | None
) -> User:
    """Return the customer an appointment is booked for.

    No customer_id (or the caller's own id) means the caller books for themselves.
    Booking for someone else requires staff/admin, and the target must be an
    active customer account.
    """
    if customer_id is None or customer_id == user.id:
        return user
    if user.role not in STAFF_ROLES:
        raise BookingForbidden()
    customer = db.get(User, customer_id)
    if customer is None or not customer.is_active or customer.role != CUSTOMER_ROLE:
        raise CustomerNotFound()
    return customer


def create_appointment(
    db: Session,
    *,
    user: User,
    service_id: uuid.UUID,
    starts_at: datetime,
    notes: str,
    now: datetime,
    customer_id: uuid.UUID | None = None,
) -> Appointment:
    """Book `service_id` at `starts_at`, for `user` or (staff only) for `customer_id`.

    created_by_id is always the acting user.
    Raises BookingForbidden, CustomerNotFound, ServiceNotFound (unknown or
    inactive service), SlotTaken, SlotNotBookable.
    """
    customer = _resolve_customer(db, user, customer_id)

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
        customer_id=customer.id,
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
        if sqlstate(exc) == EXCLUSION_VIOLATION:
            raise SlotTaken() from exc
        raise
    return appointment


def cancel_appointment(
    db: Session,
    *,
    user: User,
    appointment_id: uuid.UUID,
    now: datetime,
) -> Appointment:
    """Cancel an appointment.

    Raises AppointmentNotFound, ChangeWindowClosed, AppointmentNotActive.
    Cancelling an already-cancelled appointment returns it unchanged.
    """
    appointment = _load_for_update(db, user, appointment_id)

    if appointment.status == AppointmentStatus.CANCELLED:
        return appointment
    if appointment.status != AppointmentStatus.BOOKED:
        raise AppointmentNotActive()

    _check_change_window(user, appointment, now)

    appointment.status = AppointmentStatus.CANCELLED.value
    appointment.cancelled_at = now
    appointment.cancelled_by_id = user.id
    db.flush()
    return appointment


def reschedule_appointment(
    db: Session,
    *,
    user: User,
    appointment_id: uuid.UUID,
    starts_at: datetime,
    now: datetime,
) -> Appointment:
    """Move a booked appointment to `starts_at` (same service, same length).

    The 24h rule applies to the CURRENT start time for customers.
    Raises AppointmentNotFound, AppointmentNotActive, ChangeWindowClosed,
    ServiceNotFound, SlotTaken, SlotNotBookable.
    """
    appointment = _load_for_update(db, user, appointment_id)

    if appointment.status != AppointmentStatus.BOOKED:
        raise AppointmentNotActive()

    _check_change_window(user, appointment, now)

    starts_at = starts_at.astimezone(timezone.utc)
    local_day = starts_at.astimezone(BUSINESS_TZ).date()

    free = get_free_slots(
        db,
        appointment.service_id,
        local_day,
        now=now,
        exclude_appointment_id=appointment.id,
    )
    service = db.get(Service, appointment.service_id)
    assert service is not None  # get_free_slots just loaded it
    ends_at = starts_at + timedelta(minutes=service.duration_minutes)

    if starts_at not in free:
        if _overlaps_active_appointment(db, starts_at, ends_at, exclude_id=appointment.id):
            raise SlotTaken()
        raise SlotNotBookable()

    try:
        with db.begin_nested():  # savepoint, same reasoning as create_appointment
            appointment.starts_at = starts_at
            appointment.ends_at = ends_at
            db.flush()
    except IntegrityError as exc:
        if sqlstate(exc) == EXCLUSION_VIOLATION:
            raise SlotTaken() from exc
        raise
    return appointment


def mark_appointment(
    db: Session,
    *,
    user: User,
    appointment_id: uuid.UUID,
    status: AppointmentStatus,
    now: datetime,
) -> Appointment:
    """Mark a booked appointment as completed or no_show (staff/admin only).

    Raises BookingForbidden, AppointmentNotFound, AppointmentNotActive,
    AppointmentNotStarted. Marking with the status it already has returns it unchanged.
    """
    if status not in MARKABLE_STATUSES:
        raise ValueError(f"cannot mark an appointment as {status!r}")
    if user.role not in STAFF_ROLES:
        raise BookingForbidden()

    appointment = _load_for_update(db, user, appointment_id)

    if appointment.status == status.value:
        return appointment
    if appointment.status != AppointmentStatus.BOOKED:
        raise AppointmentNotActive()
    if appointment.starts_at > now:
        raise AppointmentNotStarted()

    appointment.status = status.value
    db.flush()
    return appointment
