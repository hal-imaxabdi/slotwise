"""Unavailable periods: closures that block booking for everyone.

Flushes only; the caller (router) commits.
"""

import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.availability import BUSINESS_TZ
from app.booking import STAFF_ROLES, BookingError, BookingForbidden
from app.models import Appointment, UnavailablePeriod, User
from app.models.appointment import AppointmentStatus

GRID_MINUTES = 30


class InvalidPeriod(BookingError):
    """End not after start, or times not on the 30-minute grid (maps to 422)."""


class PeriodNotFound(BookingError):
    """Unknown unavailable-period id (maps to 404)."""


class PeriodConflictsWithAppointments(BookingError):
    """Active appointments fall inside the period (maps to 409)."""

    def __init__(self, count: int) -> None:
        super().__init__(count)
        self.count = count


def _on_grid(moment: datetime) -> bool:
    return moment.minute % GRID_MINUTES == 0 and moment.second == 0 and moment.microsecond == 0


def _local_day_start_utc(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=BUSINESS_TZ).astimezone(timezone.utc)


def create_period(
    db: Session,
    *,
    user: User,
    starts_at: datetime,
    ends_at: datetime,
    reason: str,
) -> UnavailablePeriod:
    """Block [starts_at, ends_at) for everyone (staff/admin only).

    Raises BookingForbidden, InvalidPeriod, PeriodConflictsWithAppointments.
    """
    if user.role not in STAFF_ROLES:
        raise BookingForbidden()

    starts_at = starts_at.astimezone(timezone.utc)
    ends_at = ends_at.astimezone(timezone.utc)
    if ends_at <= starts_at:
        raise InvalidPeriod()
    if not (_on_grid(starts_at) and _on_grid(ends_at)):
        raise InvalidPeriod()

    conflicts = db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.status != AppointmentStatus.CANCELLED.value,
            Appointment.starts_at < ends_at,
            Appointment.ends_at > starts_at,
        )
    )
    if conflicts:
        raise PeriodConflictsWithAppointments(conflicts)

    period = UnavailablePeriod(
        starts_at=starts_at,
        ends_at=ends_at,
        reason=reason.strip(),
        created_by_id=user.id,
    )
    db.add(period)
    db.flush()
    return period


def delete_period(db: Session, *, user: User, period_id: uuid.UUID) -> None:
    """Remove a period (staff/admin only). Raises BookingForbidden, PeriodNotFound."""
    if user.role not in STAFF_ROLES:
        raise BookingForbidden()
    period = db.get(UnavailablePeriod, period_id)
    if period is None:
        raise PeriodNotFound()
    db.delete(period)
    db.flush()


def list_periods(
    db: Session,
    *,
    date_from: date | None,
    date_to: date | None,
    limit: int,
    offset: int,
) -> list[UnavailablePeriod]:
    """Periods starting within the Jakarta-local date range (inclusive), newest first."""
    query = select(UnavailablePeriod)
    if date_from is not None:
        query = query.where(UnavailablePeriod.starts_at >= _local_day_start_utc(date_from))
    if date_to is not None:
        query = query.where(
            UnavailablePeriod.starts_at < _local_day_start_utc(date_to + timedelta(days=1))
        )
    return list(
        db.scalars(
            query.order_by(UnavailablePeriod.starts_at.desc(), UnavailablePeriod.id.desc())
            .limit(limit)
            .offset(offset)
        )
    )
    