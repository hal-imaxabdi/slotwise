"""Admin-only management of the weekly business hours.

Hours are replaced one weekday at a time inside a savepoint. Changing hours
that would leave a future active appointment outside every open interval is
refused (no auto-cancel). Flushes only; the caller (router) commits.
"""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.availability import BUSINESS_TZ
from app.booking import BookingError, BookingForbidden
from app.models import Appointment, AppointmentStatus, BusinessHour, Role, User

GRID_MINUTES = 30
MINUTES_PER_DAY = 1440
MAX_INTERVALS_PER_DAY = 8
EXCLUSION_VIOLATION = "23P01"


class InvalidHours(BookingError):
    """Bad weekday or intervals (maps to 422). str(exc) is a safe message."""


class HoursConflictWithAppointments(BookingError):
    """Future active appointments would fall outside the new hours (maps to 409)."""

    def __init__(self, count: int) -> None:
        super().__init__(count)
        self.count = count


def _sqlstate(exc: IntegrityError) -> str | None:
    orig = exc.orig
    return getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None)


def _require_admin(user: User) -> None:
    if user.role != Role.ADMIN.value:
        raise BookingForbidden()


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _validate_weekday(weekday: object) -> None:
    if not _is_int(weekday) or not 0 <= weekday <= 6:
        raise InvalidHours("weekday must be 0 (Monday) to 6 (Sunday)")


def _validate_intervals(intervals: Sequence[tuple[int, int]]) -> list[tuple[int, int]]:
    """Return the intervals sorted by opening time. Raises InvalidHours."""
    if len(intervals) > MAX_INTERVALS_PER_DAY:
        raise InvalidHours(f"at most {MAX_INTERVALS_PER_DAY} intervals per day")

    clean: list[tuple[int, int]] = []
    for open_minute, close_minute in intervals:
        if not (_is_int(open_minute) and _is_int(close_minute)):
            raise InvalidHours("interval minutes must be integers")
        if not 0 <= open_minute < close_minute <= MINUTES_PER_DAY:
            raise InvalidHours(
                f"each interval needs 0 <= open < close <= {MINUTES_PER_DAY}"
            )
        if open_minute % GRID_MINUTES or close_minute % GRID_MINUTES:
            raise InvalidHours(f"interval times must be multiples of {GRID_MINUTES} minutes")
        clean.append((open_minute, close_minute))

    clean.sort()
    for (_, previous_close), (next_open, _) in zip(clean, clean[1:]):
        if next_open < previous_close:
            raise InvalidHours("intervals must not overlap")
    return clean


def _count_conflicts(
    db: Session, weekday: int, intervals: list[tuple[int, int]], now: datetime
) -> int:
    """Future active appointments on this Jakarta weekday that fit no single interval."""
    rows = db.execute(
        select(Appointment.starts_at, Appointment.ends_at).where(
            Appointment.status != AppointmentStatus.CANCELLED.value,
            Appointment.starts_at > now,
        )
    ).all()

    count = 0
    for starts_at, ends_at in rows:
        local = starts_at.astimezone(BUSINESS_TZ)
        if local.weekday() != weekday:
            continue
        start_minute = local.hour * 60 + local.minute
        end_minute = start_minute + int((ends_at - starts_at).total_seconds() // 60)
        if not any(o <= start_minute and end_minute <= c for o, c in intervals):
            count += 1
    return count


def list_hours(db: Session) -> list[BusinessHour]:
    """Every interval, ordered by weekday then opening time."""
    return list(
        db.scalars(
            select(BusinessHour).order_by(
                BusinessHour.weekday, BusinessHour.open_minute, BusinessHour.id
            )
        )
    )


def replace_day(
    db: Session,
    *,
    user: User,
    weekday: int,
    intervals: Sequence[tuple[int, int]],
    now: datetime,
) -> list[BusinessHour]:
    """Replace the open intervals of one weekday (admin only). [] closes the day.

    Raises BookingForbidden, InvalidHours, HoursConflictWithAppointments.
    Submitting the hours that are already stored changes nothing.
    """
    _require_admin(user)
    _validate_weekday(weekday)
    new = _validate_intervals(intervals)

    existing = list(
        db.scalars(
            select(BusinessHour)
            .where(BusinessHour.weekday == weekday)
            .order_by(BusinessHour.open_minute)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    )
    if [(h.open_minute, h.close_minute) for h in existing] == new:
        return existing

    conflicts = _count_conflicts(db, weekday, new, now)
    if conflicts:
        raise HoursConflictWithAppointments(conflicts)

    try:
        with db.begin_nested():  # savepoint: a failure restores the old hours
            db.execute(delete(BusinessHour).where(BusinessHour.weekday == weekday))
            rows = [
                BusinessHour(weekday=weekday, open_minute=o, close_minute=c) for o, c in new
            ]
            db.add_all(rows)
            db.flush()
    except IntegrityError as exc:
        if _sqlstate(exc) == EXCLUSION_VIOLATION:
            raise InvalidHours("business hours changed concurrently; reload and retry") from exc
        raise
    return rows
