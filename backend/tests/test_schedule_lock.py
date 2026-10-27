import uuid
from contextlib import contextmanager
from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.admin_hours import replace_day
from app.booking import create_appointment, reschedule_appointment
from app.locks import lock_schedule_exclusive, lock_schedule_shared
from app.models import User
from app.unavailable import create_period

NOW = datetime(2026, 10, 26, tzinfo=UTC)
SLOT = datetime(2026, 11, 2, 2, 30, tzinfo=UTC)


@contextmanager
def held_elsewhere(engine, *, exclusive: bool):
    """Hold the schedule lock in a second, independent session."""
    with Session(engine) as other:
        (lock_schedule_exclusive if exclusive else lock_schedule_shared)(other)
        yield  # leaving the block closes the session, which releases the lock


def fail_fast(db) -> None:
    db.execute(text("SET LOCAL lock_timeout = '200ms'"))


def test_two_shared_holders_do_not_block_each_other(engine, db):
    with held_elsewhere(engine, exclusive=False):
        fail_fast(db)
        lock_schedule_shared(db)


def test_exclusive_holder_blocks_a_shared_taker(engine, db):
    with held_elsewhere(engine, exclusive=True):
        fail_fast(db)
        with pytest.raises(OperationalError, match="lock timeout"):
            lock_schedule_shared(db)


def test_shared_holder_blocks_an_exclusive_taker(engine, db):
    with held_elsewhere(engine, exclusive=False):
        fail_fast(db)
        with pytest.raises(OperationalError, match="lock timeout"):
            lock_schedule_exclusive(db)


def test_lock_is_released_when_the_holder_ends(engine, db):
    with held_elsewhere(engine, exclusive=True):
        pass
    fail_fast(db)
    lock_schedule_exclusive(db)


def test_create_appointment_waits_for_an_exclusive_holder(engine, db):
    with held_elsewhere(engine, exclusive=True):
        fail_fast(db)
        with pytest.raises(OperationalError, match="lock timeout"):
            create_appointment(
                db,
                user=User(role="customer"),
                service_id=uuid.uuid4(),
                starts_at=SLOT,
                notes="",
                now=NOW,
            )


def test_reschedule_waits_for_an_exclusive_holder(engine, db):
    with held_elsewhere(engine, exclusive=True):
        fail_fast(db)
        with pytest.raises(OperationalError, match="lock timeout"):
            reschedule_appointment(
                db,
                user=User(role="customer"),
                appointment_id=uuid.uuid4(),
                starts_at=SLOT,
                now=NOW,
            )


def test_replace_day_waits_for_an_in_flight_booking(engine, db):
    with held_elsewhere(engine, exclusive=False):
        fail_fast(db)
        with pytest.raises(OperationalError, match="lock timeout"):
            replace_day(
                db,
                user=User(role="admin"),
                weekday=0,
                intervals=[(540, 720)],
                now=NOW,
            )


def test_create_period_waits_for_an_in_flight_booking(engine, db):
    with held_elsewhere(engine, exclusive=False):
        fail_fast(db)
        with pytest.raises(OperationalError, match="lock timeout"):
            create_period(
                db,
                user=User(role="staff"),
                starts_at=datetime(2026, 11, 3, 2, 0, tzinfo=UTC),
                ends_at=datetime(2026, 11, 3, 3, 0, tzinfo=UTC),
                reason="closed",
            )
            