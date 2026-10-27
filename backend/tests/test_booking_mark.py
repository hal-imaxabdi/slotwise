import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.booking import (
    AppointmentNotActive,
    AppointmentNotFound,
    AppointmentNotStarted,
    BookingForbidden,
    mark_appointment,
)
from app.models import Appointment, AppointmentStatus, Service, User

NOW = datetime(2026, 11, 2, 10, 0, tzinfo=timezone.utc)
PAST = NOW - timedelta(hours=2)
FUTURE = NOW + timedelta(hours=2)


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
    if status == "cancelled":
        appt.cancelled_at = NOW
        appt.cancelled_by_id = owner.id
    db.add(appt)
    db.commit()
    return appt


@pytest.mark.parametrize("role", ["staff", "admin"])
@pytest.mark.parametrize("target", [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW])
def test_staff_marks_past_booked_appointment(db, role, target):
    owner = _user(db, "owner@example.com")
    actor = _user(db, "actor@example.com", role=role)
    appt = _appt(db, owner, _service(db), PAST)
    result = mark_appointment(
        db, user=actor, appointment_id=appt.id, status=target, now=NOW
    )
    db.commit()
    db.refresh(appt)
    assert result.id == appt.id
    assert appt.status == target.value
    assert appt.cancelled_at is None


def test_appointment_starting_exactly_now_is_allowed(db):
    owner = _user(db, "owner@example.com")
    staff = _user(db, "staff@example.com", role="staff")
    appt = _appt(db, owner, _service(db), NOW)
    mark_appointment(
        db, user=staff, appointment_id=appt.id, status=AppointmentStatus.COMPLETED, now=NOW
    )
    db.refresh(appt)
    assert appt.status == "completed"


def test_future_appointment_is_not_started(db):
    owner = _user(db, "owner@example.com")
    staff = _user(db, "staff@example.com", role="staff")
    appt = _appt(db, owner, _service(db), FUTURE)
    with pytest.raises(AppointmentNotStarted):
        mark_appointment(
            db, user=staff, appointment_id=appt.id, status=AppointmentStatus.NO_SHOW, now=NOW
        )
    db.refresh(appt)
    assert appt.status == "booked"


def test_same_status_again_is_idempotent(db):
    owner = _user(db, "owner@example.com")
    staff = _user(db, "staff@example.com", role="staff")
    appt = _appt(db, owner, _service(db), PAST, status="completed")
    result = mark_appointment(
        db, user=staff, appointment_id=appt.id, status=AppointmentStatus.COMPLETED, now=NOW
    )
    assert result.status == "completed"


def test_completed_cannot_become_no_show(db):
    owner = _user(db, "owner@example.com")
    staff = _user(db, "staff@example.com", role="staff")
    appt = _appt(db, owner, _service(db), PAST, status="completed")
    with pytest.raises(AppointmentNotActive):
        mark_appointment(
            db, user=staff, appointment_id=appt.id, status=AppointmentStatus.NO_SHOW, now=NOW
        )
    db.refresh(appt)
    assert appt.status == "completed"


def test_cancelled_cannot_be_marked(db):
    owner = _user(db, "owner@example.com")
    staff = _user(db, "staff@example.com", role="staff")
    appt = _appt(db, owner, _service(db), PAST, status="cancelled")
    with pytest.raises(AppointmentNotActive):
        mark_appointment(
            db, user=staff, appointment_id=appt.id, status=AppointmentStatus.COMPLETED, now=NOW
        )
    db.refresh(appt)
    assert appt.status == "cancelled"


def test_cancelled_future_reports_not_active_not_not_started(db):
    owner = _user(db, "owner@example.com")
    staff = _user(db, "staff@example.com", role="staff")
    appt = _appt(db, owner, _service(db), FUTURE, status="cancelled")
    with pytest.raises(AppointmentNotActive):
        mark_appointment(
            db, user=staff, appointment_id=appt.id, status=AppointmentStatus.COMPLETED, now=NOW
        )


def test_customer_is_forbidden_even_for_own_appointment(db):
    owner = _user(db, "owner@example.com")
    appt = _appt(db, owner, _service(db), PAST)
    with pytest.raises(BookingForbidden):
        mark_appointment(
            db, user=owner, appointment_id=appt.id, status=AppointmentStatus.COMPLETED, now=NOW
        )
    db.refresh(appt)
    assert appt.status == "booked"


def test_unknown_id_is_not_found(db):
    staff = _user(db, "staff@example.com", role="staff")
    db.commit()
    with pytest.raises(AppointmentNotFound):
        mark_appointment(
            db,
            user=staff,
            appointment_id=uuid.uuid4(),
            status=AppointmentStatus.COMPLETED,
            now=NOW,
        )


@pytest.mark.parametrize("bad", [AppointmentStatus.BOOKED, AppointmentStatus.CANCELLED])
def test_other_target_statuses_are_a_programmer_error(db, bad):
    owner = _user(db, "owner@example.com")
    staff = _user(db, "staff@example.com", role="staff")
    appt = _appt(db, owner, _service(db), PAST)
    with pytest.raises(ValueError):
        mark_appointment(db, user=staff, appointment_id=appt.id, status=bad, now=NOW)
    db.refresh(appt)
    assert appt.status == "booked"
    