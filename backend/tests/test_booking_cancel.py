import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.availability import get_free_slots
from app.booking import (
    AppointmentNotActive,
    AppointmentNotFound,
    ChangeWindowClosed,
    cancel_appointment,
)
from app.models import Appointment, BusinessHour, Service, User

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=timezone.utc)
FAR_START = datetime(2026, 11, 2, 2, 30, tzinfo=timezone.utc)  # Mon 09:30 Jakarta, > 24h away
MONDAY = date(2026, 11, 2)


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


def _service(db) -> Service:
    service = Service(
        name="Haircut",
        description="test service",
        duration_minutes=30,
        price_idr=50000,
        is_active=True,
    )
    db.add(service)
    db.flush()
    return service


def _appt(db, owner: User, service: Service, start: datetime, status: str = "booked") -> Appointment:
    appt = Appointment(
        customer_id=owner.id,
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(minutes=30),
        status=status,
        created_by_id=owner.id,
    )
    db.add(appt)
    db.commit()
    return appt


def test_customer_cancels_own_appointment(db):
    owner = _user(db, "owner@example.com")
    appt = _appt(db, owner, _service(db), FAR_START)
    result = cancel_appointment(db, user=owner, appointment_id=appt.id, now=NOW)
    db.commit()
    db.refresh(appt)
    assert result.id == appt.id
    assert appt.status == "cancelled"
    assert appt.cancelled_at == NOW
    assert appt.cancelled_by_id == owner.id


def test_other_customer_gets_not_found(db):
    owner = _user(db, "owner@example.com")
    stranger = _user(db, "stranger@example.com")
    appt = _appt(db, owner, _service(db), FAR_START)
    with pytest.raises(AppointmentNotFound):
        cancel_appointment(db, user=stranger, appointment_id=appt.id, now=NOW)
    db.refresh(appt)
    assert appt.status == "booked"


def test_unknown_id_gets_not_found(db):
    owner = _user(db, "owner@example.com")
    db.commit()
    with pytest.raises(AppointmentNotFound):
        cancel_appointment(db, user=owner, appointment_id=uuid.uuid4(), now=NOW)


def test_customer_inside_24h_is_refused(db):
    owner = _user(db, "owner@example.com")
    start = NOW + timedelta(hours=23, minutes=30)
    appt = _appt(db, owner, _service(db), start)
    with pytest.raises(ChangeWindowClosed):
        cancel_appointment(db, user=owner, appointment_id=appt.id, now=NOW)
    db.refresh(appt)
    assert appt.status == "booked"


def test_customer_at_exactly_24h_is_allowed(db):
    owner = _user(db, "owner@example.com")
    appt = _appt(db, owner, _service(db), NOW + timedelta(hours=24))
    cancel_appointment(db, user=owner, appointment_id=appt.id, now=NOW)
    db.refresh(appt)
    assert appt.status == "cancelled"


def test_staff_can_cancel_anyones_appointment_inside_24h(db):
    owner = _user(db, "owner@example.com")
    staff = _user(db, "staff@example.com", role="staff")
    appt = _appt(db, owner, _service(db), NOW + timedelta(hours=1))
    cancel_appointment(db, user=staff, appointment_id=appt.id, now=NOW)
    db.commit()
    db.refresh(appt)
    assert appt.status == "cancelled"
    assert appt.cancelled_by_id == staff.id
    assert appt.customer_id == owner.id


def test_cancelling_twice_keeps_original_cancellation(db):
    owner = _user(db, "owner@example.com")
    staff = _user(db, "staff@example.com", role="staff")
    appt = _appt(db, owner, _service(db), FAR_START)
    cancel_appointment(db, user=owner, appointment_id=appt.id, now=NOW)
    db.commit()
    later = NOW + timedelta(hours=5)
    cancel_appointment(db, user=staff, appointment_id=appt.id, now=later)
    db.commit()
    db.refresh(appt)
    assert appt.cancelled_at == NOW
    assert appt.cancelled_by_id == owner.id


def test_completed_appointment_cannot_be_cancelled(db):
    owner = _user(db, "owner@example.com")
    appt = _appt(db, owner, _service(db), FAR_START, status="completed")
    with pytest.raises(AppointmentNotActive):
        cancel_appointment(db, user=owner, appointment_id=appt.id, now=NOW)
    db.refresh(appt)
    assert appt.status == "completed"


def test_cancelled_slot_becomes_free_again(db):
    owner = _user(db, "owner@example.com")
    service = _service(db)
    db.add(BusinessHour(weekday=0, open_minute=540, close_minute=720))
    appt = _appt(db, owner, service, FAR_START)
    assert FAR_START not in get_free_slots(db, service.id, MONDAY, now=NOW)
    cancel_appointment(db, user=owner, appointment_id=appt.id, now=NOW)
    db.commit()
    assert FAR_START in get_free_slots(db, service.id, MONDAY, now=NOW)
    