"""Pure slot calculator: no database, no clock, no I/O.

All datetimes passed in or returned are timezone-aware. Results are in UTC.
Ranges are half-open [start, end), matching the database exclusion constraint.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

SLOT_MINUTES = 30
UTC = timezone.utc


def _require_aware(value: datetime, name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


@dataclass(frozen=True)
class Window:
    """A half-open time range [start, end) with aware datetimes."""

    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        _require_aware(self.start, "start")
        _require_aware(self.end, "end")
        if self.end <= self.start:
            raise ValueError("end must be after start")

    def overlaps(self, other: Window) -> bool:
        return self.start < other.end and other.start < self.end


@dataclass(frozen=True)
class OpenInterval:
    """One business-hours interval; minutes are wall-clock minutes after LOCAL midnight."""

    weekday: int  # 0 = Monday ... 6 = Sunday
    open_minute: int
    close_minute: int

    def __post_init__(self) -> None:
        if not 0 <= self.weekday <= 6:
            raise ValueError("weekday must be 0..6")
        if not 0 <= self.open_minute < self.close_minute <= 1440:
            raise ValueError("need 0 <= open_minute < close_minute <= 1440")


def local_minute_to_utc(day: date, minute: int, tz: ZoneInfo) -> datetime:
    """Convert 'minutes after local midnight on `day`' to an aware UTC datetime.

    Adding a timedelta to an aware datetime with a ZoneInfo does wall-clock
    arithmetic, so this stays correct across DST changes. minute == 1440 means
    midnight at the end of the day.
    """
    local_midnight = datetime.combine(day, time.min, tzinfo=tz)
    return (local_midnight + timedelta(minutes=minute)).astimezone(UTC)


def compute_free_starts(
    *,
    day: date,
    tz: ZoneInfo,
    hours: Iterable[OpenInterval],
    duration_minutes: int,
    blocked: Sequence[Window],
    now: datetime,
    step_minutes: int = SLOT_MINUTES,
) -> list[datetime]:
    """Return free start times (aware, UTC, ascending) for `day` in business tz `tz`.

    `day` is the LOCAL calendar date. `blocked` holds unavailable periods and
    active (non-cancelled) appointments. `now` is passed in so tests control the clock.
    """
    _require_aware(now, "now")
    if step_minutes <= 0:
        raise ValueError("step_minutes must be positive")
    if duration_minutes <= 0 or duration_minutes % step_minutes != 0:
        raise ValueError("duration_minutes must be a positive multiple of step_minutes")

    duration = timedelta(minutes=duration_minutes)
    step = timedelta(minutes=step_minutes)
    weekday = day.weekday()
    starts: list[datetime] = []

    for interval in hours:
        if interval.weekday != weekday:
            continue
        open_at = local_minute_to_utc(day, interval.open_minute, tz)
        close_at = local_minute_to_utc(day, interval.close_minute, tz)

        start = open_at
        while start + duration <= close_at:
            slot = Window(start, start + duration)
            if start > now and not any(slot.overlaps(b) for b in blocked):
                starts.append(start)
            start += step

    return sorted(starts)
