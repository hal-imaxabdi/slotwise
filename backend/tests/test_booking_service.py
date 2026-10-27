import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.availability import ServiceNotFound
from app.booking import SlotNotBookable, SlotTaken, create_appointment
from app.models import Appointment, BusinessHour, Service, User

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=timezone.utc)
A_START = datetime(2026, 11, 2, 2, 30, tzinfo=timezone.utc)  # Mon 09:30 Jakarta
PAST_START = datetime(2026, 10, 19, 2, 30, tzinfo=timezone.utc)  # Mon before NOW
CLOSED_START = datetime(2026, 11, 2, 5, 0, tzinfo=timezone.utc)  # Mon 12:00 Jakarta (closed)
OFF_GRID_START = datetime(2026, 11, 2, 2, 45, tzinfo=timezone.utc)  # Mon 09:45 Jakarta


def _setup(db, *, duration: int = 30, active: bool = True) -> tuple[User, Service]:
    user = User(
        email="booking.test@example.com",
        password_hash="!unusable",
        full_name="Booking Test",
        role="customer",
        is_active=True,
    )
    service = Service(
        name="Haircut",
        description="test service",
        duration_minutes=duration,
        price_idr=50000,
        is_active=active,
    )
    db.add_all([user, service])
    db.flush()
    db.add(BusinessHour(weekday=0, open_minute=540, close_minute=720))
    db.commit()
    return user, service


def _existing(db, user: User, service: Service, start: datetime) -> None:
    db.add(
        Appointment(
            customer_id=user.id,
            service_id=service.id,
            starts_at=start,
            ends_at=start + timedelta(minutes=service.duration_minutes),
            created_by_id=user.id,
        )
    )
    db.commit()


def _count(db) -> int:
    return db.scalar(select(func.count()).select_from(Appointment))


def test_create_saves_row_with_correct_end(db):
    user, service = _setup(db, duration=60)
    appt = create_appointment(
        db, user=user, service_id=service.id, starts_at=A_START, notes="hi", now=NOW
    )
    db.commit()
    assert appt.id is not None
    assert appt.customer_id == user.id
    assert appt.created_by_id == user.id
    assert appt.starts_at == A_START
    assert appt.ends_at == A_START + timedelta(minutes=60)
    assert appt.status == "booked"
    assert _count(db) == 1


def test_taken_slot_raises_slot_taken(db):
    user, service = _setup(db)
    _existing(db, user, service, A_START)
    with pytest.raises(SlotTaken):
        create_appointment(
            db, user=user, service_id=service.id, starts_at=A_START, notes="", now=NOW
        )
    assert _count(db) == 1


def test_past_time_raises_not_bookable(db):
    user, service = _setup(db)
    with pytest.raises(SlotNotBookable):
        create_appointment(
            db, user=user, service_id=service.id, starts_at=PAST_START, notes="", now=NOW
        )
    assert _count(db) == 0


def test_outside_business_hours_raises_not_bookable(db):
    user, service = _setup(db)
    with pytest.raises(SlotNotBookable):
        create_appointment(
            db, user=user, service_id=service.id, starts_at=CLOSED_START, notes="", now=NOW
        )
    assert _count(db) == 0


def test_off_grid_start_raises_not_bookable(db):
    user, service = _setup(db)
    with pytest.raises(SlotNotBookable):
        create_appointment(
            db, user=user, service_id=service.id, starts_at=OFF_GRID_START, notes="", now=NOW
        )
    assert _count(db) == 0


def test_unknown_service_raises_service_not_found(db):
    user, _service = _setup(db)
    with pytest.raises(ServiceNotFound):
        create_appointment(
            db, user=user, service_id=uuid.uuid4(), starts_at=A_START, notes="", now=NOW
        )


def test_inactive_service_raises_service_not_found(db):
    user, service = _setup(db, active=False)
    with pytest.raises(ServiceNotFound):
        create_appointment(
            db, user=user, service_id=service.id, starts_at=A_START, notes="", now=NOW
        )


def test_race_path_constraint_violation_becomes_slot_taken(db, monkeypatch):
    user, service = _setup(db)
    _existing(db, user, service, A_START)
    # Simulate the race: the availability check wrongly says the slot is free,
    # so only the DB exclusion constraint (SQLSTATE 23P01) can stop the insert.
    monkeypatch.setattr("app.booking.get_free_slots", lambda *a, **k: [A_START])
    with pytest.raises(SlotTaken):
        create_appointment(
            db, user=user, service_id=service.id, starts_at=A_START, notes="", now=NOW
        )
    # The savepoint rolled back only the failed insert; the session still works.
    assert _count(db) == 1
    