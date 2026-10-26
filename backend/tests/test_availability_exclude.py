import uuid
from datetime import datetime, timedelta, timezone
from datetime import date

from app.availability import get_free_slots
from app.models import Appointment, BusinessHour, Service, User

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=timezone.utc)
MONDAY = date(2026, 11, 2)
A_START = datetime(2026, 11, 2, 2, 30, tzinfo=timezone.utc)  # 09:30 Jakarta
B_START = datetime(2026, 11, 2, 3, 0, tzinfo=timezone.utc)  # 10:00 Jakarta


def _setup(db) -> tuple[Service, Appointment, Appointment]:
    user = User(
        email="exclude.test@example.com",
        password_hash="!unusable",
        full_name="Exclude Test",
        role="customer",
        is_active=True,
    )
    service = Service(
        name="Haircut",
        description="30 min",
        duration_minutes=30,
        price_idr=50000,
        is_active=True,
    )
    db.add_all([user, service])
    db.flush()
    db.add(BusinessHour(weekday=0, open_minute=540, close_minute=720))

    appts = []
    for start in (A_START, B_START):
        appt = Appointment(
            customer_id=user.id,
            service_id=service.id,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            created_by_id=user.id,
        )
        db.add(appt)
        appts.append(appt)
    db.commit()
    return service, appts[0], appts[1]


def test_booked_slots_are_blocked_by_default(db):
    service, _a, _b = _setup(db)
    free = get_free_slots(db, service.id, MONDAY, now=NOW)
    assert A_START not in free
    assert B_START not in free


def test_excluding_an_appointment_frees_only_its_own_slot(db):
    service, a, _b = _setup(db)
    free = get_free_slots(db, service.id, MONDAY, now=NOW, exclude_appointment_id=a.id)
    assert A_START in free
    assert B_START not in free


def test_excluding_an_unknown_id_changes_nothing(db):
    service, _a, _b = _setup(db)
    baseline = get_free_slots(db, service.id, MONDAY, now=NOW)
    other = get_free_slots(db, service.id, MONDAY, now=NOW, exclude_appointment_id=uuid.uuid4())
    assert other == baseline
    