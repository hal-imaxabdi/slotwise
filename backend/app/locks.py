"""One app-wide advisory lock that orders bookings against schedule changes.

Bookings take it shared, so they still run concurrently with each other.
Hours and closure changes take it exclusive, so they wait for in-flight bookings
and block new ones until they commit. Transaction-level: released automatically
at commit or rollback, so it cannot leak. Take it BEFORE reading the schedule
or counting conflicts, never inside a savepoint.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

SCHEDULE_LOCK_KEY = 7_340_001  # arbitrary constant, unique to this app

_SHARED = text("SELECT pg_advisory_xact_lock_shared(CAST(:key AS bigint))")
_EXCLUSIVE = text("SELECT pg_advisory_xact_lock(CAST(:key AS bigint))")


def lock_schedule_shared(db: Session) -> None:
    """For bookings and reschedules (read the schedule, then insert)."""
    db.execute(_SHARED, {"key": SCHEDULE_LOCK_KEY})


def lock_schedule_exclusive(db: Session) -> None:
    """For hours and closure changes (count conflicts, then write)."""
    db.execute(_EXCLUSIVE, {"key": SCHEDULE_LOCK_KEY})
    