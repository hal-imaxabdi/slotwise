from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.booking import (
    BookingForbidden,
    CustomerNotFound,
    create_appointment,
)
from app.models import Appointment, BusinessHour, Service, User

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=timezone.utc)
A_START = datetime(2026, 11, 2, 2, 30, tzinfo=timezone.utc)  # Mon 09:30 Jakarta


def _user(db, email: str, role: str = "customer", active: bool = True) -> User:
    user = User(
        email=email,
        password_hash="!unusable",
        full_name=email.split("@")[0],
        role=role,
        is_active=active,
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
    db.add(BusinessHour(weekday=0, open_minute=540, close_minute=720))
    db.commit()
    return service


def _count(db) -> int:
    return db.scalar(select(func.count()).select_from(Appointment))


@pytest.mark.parametrize("role", ["staff", "admin"])
def test_staff_or_admin_books_for_customer(db, role):
    customer = _user(db, "customer@example.com")
    actor = _user(db, "actor@example.com", role=role)
    service = _service(db)
    appt = create_appointment(
        db,
        user=actor,
        service_id=service.id,
        starts_at=A_START,
        notes="walk-in",
        now=NOW,
        customer_id=customer.id,
    )
    db.commit()
    assert appt.customer_id == customer.id
    assert appt.created_by_id == actor.id
    assert appt.starts_at == A_START
    assert _count(db) == 1


def test_staff_without_customer_id_books_for_self(db):
    staff = _user(db, "staff@example.com", role="staff")
    service = _service(db)
    appt = create_appointment(
        db, user=staff, service_id=service.id, starts_at=A_START, notes="", now=NOW
    )
    assert appt.customer_id == staff.id
    assert appt.created_by_id == staff.id


def test_customer_may_pass_their_own_id(db):
    customer = _user(db, "customer@example.com")
    service = _service(db)
    appt = create_appointment(
        db,
        user=customer,
        service_id=service.id,
        starts_at=A_START,
        notes="",
        now=NOW,
        customer_id=customer.id,
    )
    assert appt.customer_id == customer.id
    assert appt.created_by_id == customer.id


def test_customer_cannot_book_for_someone_else(db):
    customer = _user(db, "customer@example.com")
    victim = _user(db, "victim@example.com")
    service = _service(db)
    with pytest.raises(BookingForbidden):
        create_appointment(
            db,
            user=customer,
            service_id=service.id,
            starts_at=A_START,
            notes="",
            now=NOW,
            customer_id=victim.id,
        )
    assert _count(db) == 0


def test_unknown_customer_id_raises_customer_not_found(db):
    import uuid

    staff = _user(db, "staff@example.com", role="staff")
    service = _service(db)
    with pytest.raises(CustomerNotFound):
        create_appointment(
            db,
            user=staff,
            service_id=service.id,
            starts_at=A_START,
            notes="",
            now=NOW,
            customer_id=uuid.uuid4(),
        )
    assert _count(db) == 0


def test_inactive_customer_raises_customer_not_found(db):
    staff = _user(db, "staff@example.com", role="staff")
    customer = _user(db, "gone@example.com", active=False)
    service = _service(db)
    with pytest.raises(CustomerNotFound):
        create_appointment(
            db,
            user=staff,
            service_id=service.id,
            starts_at=A_START,
            notes="",
            now=NOW,
            customer_id=customer.id,
        )
    assert _count(db) == 0


@pytest.mark.parametrize("target_role", ["staff", "admin"])
def test_non_customer_target_raises_customer_not_found(db, target_role):
    staff = _user(db, "staff@example.com", role="staff")
    target = _user(db, "target@example.com", role=target_role)
    service = _service(db)
    with pytest.raises(CustomerNotFound):
        create_appointment(
            db,
            user=staff,
            service_id=service.id,
            starts_at=A_START,
            notes="",
            now=NOW,
            customer_id=target.id,
        )
    assert _count(db) == 0
    