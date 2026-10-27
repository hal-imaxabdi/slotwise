from datetime import date, datetime, timedelta, timezone

import pytest

from app.availability import get_free_slots
from app.booking import (
    AppointmentNotActive,
    AppointmentNotFound,
    ChangeWindowClosed,
    SlotNotBookable,
    SlotTaken,
    reschedule_appointment,
)
from app.models import Appointment, BusinessHour, Service, User

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=timezone.utc)
MONDAY = date(2026, 11, 2)
OLD_START = datetime(2026, 11, 2, 2, 30, tzinfo=timezone.utc)  # Mon 09:30 Jakarta
NEW_START = datetime(2026, 11, 2, 3, 30, tzinfo=timezone.utc)  # Mon 10:30 Jakarta
CLOSED_START = datetime(2026, 11, 2, 5, 0, tzinfo=timezone.utc)  # Mon 12:00 Jakarta (closed)
PAST_START = datetime(2026, 10, 19, 2, 30, tzinfo=timezone.utc)


def _user(db, email: str, role: str = "customer") -> User:
    user = User(
        email=email,
        password_hash="!unusable",
        full_name=email.split("@")[0],
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _service(db, duration: int = 30) -> Service:
    service = Service(
        name="Haircut",
        description="test service",
        duration_minutes=duration,
        price_idr=50000,
        is_active=True,
    )
    db.add(service)
    db.add(BusinessHour(weekday=0, open_minute=540, close_minute=720))
    db.flush()
    return service


def _appt(db, owner: User, service: Service, start: datetime, status: str = "booked") -> Appointment:
    appt = Appointment(
        customer_id=owner.id,
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(minutes=service.duration_minutes),
        status=status,
        created_by_id=owner.id,
    )
    if status == "cancelled":
        appt.cancelled_at = NOW
        appt.cancelled_by_id = owner.id
    db.add(appt)
    db.commit()
    return appt


def test_customer_reschedules_own_appointment(db):
    owner = _user(db, "owner@example.com")
    appt = _appt(db, owner, _service(db), OLD_START)
    result = reschedule_appointment(
        db, user=owner, appointment_id=appt.id, starts_at=NEW_START, now=NOW
    )
    db.commit()
    db.refresh(appt)
    assert result.id == appt.id
    assert appt.starts_at == NEW_START
    assert appt.ends_at == NEW_START + timedelta(minutes=30)
    assert appt.status == "booked"


def test_other_customer_gets_not_found(db):
    owner = _user(db, "owner@example.com")
    stranger = _user(db, "stranger@example.com")
    appt = _appt(db, owner, _service(db), OLD_START)
    with pytest.raises(AppointmentNotFound):
        reschedule_appointment(
            db, user=stranger, appointment_id=appt.id, starts_at=NEW_START, now=NOW
        )
    db.refresh(appt)
    assert appt.starts_at == OLD_START


def test_customer_inside_24h_of_old_start_is_refused(db):
    owner = _user(db, "owner@example.com")
    old = NOW + timedelta(hours=1)
    appt = _appt(db, owner, _service(db), old)
    with pytest.raises(ChangeWindowClosed):
        reschedule_appointment(
            db, user=owner, appointment_id=appt.id, starts_at=NEW_START, now=NOW
        )
    db.refresh(appt)
    assert appt.starts_at == old


def test_staff_can_reschedule_inside_24h(db):
    owner = _user(db, "owner@example.com")
    staff = _user(db, "staff@example.com", role="staff")
    appt = _appt(db, owner, _service(db), NOW + timedelta(hours=1))
    reschedule_appointment(
        db, user=staff, appointment_id=appt.id, starts_at=NEW_START, now=NOW
    )
    db.commit()
    db.refresh(appt)
    assert appt.starts_at == NEW_START
    assert appt.customer_id == owner.id


def test_taken_new_slot_raises_slot_taken(db):
    owner = _user(db, "owner@example.com")
    other = _user(db, "other@example.com")
    service = _service(db)
    appt = _appt(db, owner, service, OLD_START)
    _appt(db, other, service, NEW_START)
    with pytest.raises(SlotTaken):
        reschedule_appointment(
            db, user=owner, appointment_id=appt.id, starts_at=NEW_START, now=NOW
        )
    db.refresh(appt)
    assert appt.starts_at == OLD_START


def test_past_new_time_raises_not_bookable(db):
    owner = _user(db, "owner@example.com")
    appt = _appt(db, owner, _service(db), OLD_START)
    with pytest.raises(SlotNotBookable):
        reschedule_appointment(
            db, user=owner, appointment_id=appt.id, starts_at=PAST_START, now=NOW
        )
    db.refresh(appt)
    assert appt.starts_at == OLD_START


def test_closed_new_time_raises_not_bookable(db):
    owner = _user(db, "owner@example.com")
    appt = _appt(db, owner, _service(db), OLD_START)
    with pytest.raises(SlotNotBookable):
        reschedule_appointment(
            db, user=owner, appointment_id=appt.id, starts_at=CLOSED_START, now=NOW
        )
    db.refresh(appt)
    assert appt.starts_at == OLD_START


def test_new_time_may_overlap_the_appointments_own_old_slot(db):
    owner = _user(db, "owner@example.com")
    appt = _appt(db, owner, _service(db, duration=60), OLD_START)  # 09:30-10:30
    shifted = OLD_START + timedelta(minutes=30)  # 10:00-11:00 overlaps itself
    reschedule_appointment(
        db, user=owner, appointment_id=appt.id, starts_at=shifted, now=NOW
    )
    db.commit()
    db.refresh(appt)
    assert appt.starts_at == shifted
    assert appt.ends_at == shifted + timedelta(minutes=60)


def test_cancelled_appointment_cannot_be_rescheduled(db):
    owner = _user(db, "owner@example.com")
    appt = _appt(db, owner, _service(db), OLD_START, status="cancelled")
    with pytest.raises(AppointmentNotActive):
        reschedule_appointment(
            db, user=owner, appointment_id=appt.id, starts_at=NEW_START, now=NOW
        )
    db.refresh(appt)
    assert appt.status == "cancelled"
    assert appt.starts_at == OLD_START


def test_reschedule_frees_old_slot_and_occupies_new_one(db):
    owner = _user(db, "owner@example.com")
    service = _service(db)
    appt = _appt(db, owner, service, OLD_START)
    reschedule_appointment(
        db, user=owner, appointment_id=appt.id, starts_at=NEW_START, now=NOW
    )
    db.commit()
    free = get_free_slots(db, service.id, MONDAY, now=NOW)
    assert OLD_START in free
    assert NEW_START not in free


def test_race_path_constraint_violation_becomes_slot_taken(db, monkeypatch):
    owner = _user(db, "owner@example.com")
    other = _user(db, "other@example.com")
    service = _service(db)
    appt = _appt(db, owner, service, OLD_START)
    _appt(db, other, service, NEW_START)
    # Simulate the race: the availability check wrongly says NEW_START is free,
    # so only the DB exclusion constraint (SQLSTATE 23P01) can stop the UPDATE.
    monkeypatch.setattr("app.booking.get_free_slots", lambda *a, **k: [NEW_START])
    with pytest.raises(SlotTaken):
        reschedule_appointment(
            db, user=owner, appointment_id=appt.id, starts_at=NEW_START, now=NOW
        )
    # The savepoint rolled back the failed UPDATE; the row is unchanged and the session works.
    db.refresh(appt)
    assert appt.starts_at == OLD_START
    assert appt.ends_at == OLD_START + timedelta(minutes=30)
    