import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.deps import get_now
from app.main import app
from app.models import Appointment, BusinessHour, Service, User
from app.security.passwords import hash_password

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=UTC)
PW = "correct horse battery staple"
SLOT = datetime(2026, 11, 2, 2, 30, tzinfo=UTC)  # Mon 09:30 Jakarta
CLOSED = datetime(2026, 11, 2, 5, 0, tzinfo=UTC)  # Mon 12:00 Jakarta (closed)


@pytest.fixture()
def api(client):
    app.dependency_overrides[get_now] = lambda: NOW
    yield client
    app.dependency_overrides.pop(get_now, None)


def add_user(db, email: str, role: str = "customer", active: bool = True) -> User:
    user = User(
        email=email,
        password_hash=hash_password(PW),
        full_name=email.split("@")[0],
        role=role,
        is_active=active,
    )
    db.add(user)
    db.commit()
    return user


def add_service(db, duration: int = 30) -> Service:
    service = Service(
        name="Haircut",
        description="test service",
        duration_minutes=duration,
        price_idr=50000,
        is_active=True,
    )
    db.add(service)
    db.add(BusinessHour(weekday=0, open_minute=540, close_minute=720))
    db.commit()
    return service


def add_appt(db, owner: User, service: Service, start: datetime) -> Appointment:
    appt = Appointment(
        customer_id=owner.id,
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(minutes=service.duration_minutes),
        created_by_id=owner.id,
    )
    db.add(appt)
    db.commit()
    return appt


def login(api, email: str) -> str:
    r = api.post("/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200
    return r.json()["csrf_token"]


def book(api, csrf: str | None, customer_id, service_id, start: datetime, **extra):
    headers = {"X-CSRF-Token": csrf} if csrf else {}
    return api.post(
        "/staff/appointments",
        json={
            "customer_id": str(customer_id),
            "service_id": str(service_id),
            "starts_at": start.isoformat(),
            **extra,
        },
        headers=headers,
    )


def test_requires_login(api, db):
    customer = add_user(db, "c@example.com")
    service = add_service(db)
    assert book(api, "x" * 43, customer.id, service.id, SLOT).status_code == 401


def test_without_csrf_is_403(api, db):
    customer = add_user(db, "c@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    login(api, "staff@example.com")
    assert book(api, None, customer.id, service.id, SLOT).status_code == 403


def test_customer_role_is_403(api, db):
    victim = add_user(db, "victim@example.com")
    add_user(db, "c@example.com")
    service = add_service(db)
    csrf = login(api, "c@example.com")
    assert book(api, csrf, victim.id, service.id, SLOT).status_code == 403
    assert db.query(Appointment).count() == 0


@pytest.mark.parametrize("role", ["staff", "admin"])
def test_staff_or_admin_books_for_customer(api, db, role):
    customer = add_user(db, "c@example.com")
    actor = add_user(db, "actor@example.com", role=role)
    service = add_service(db)
    csrf = login(api, "actor@example.com")
    r = book(api, csrf, customer.id, service.id, SLOT, notes="walk-in")
    assert r.status_code == 201
    body = r.json()
    assert body["customer_id"] == str(customer.id)
    assert body["created_by_id"] == str(actor.id)
    assert body["status"] == "booked"
    assert body["notes"] == "walk-in"
    assert datetime.fromisoformat(body["starts_at"]) == SLOT
    assert datetime.fromisoformat(body["ends_at"]) == SLOT + timedelta(minutes=30)
    assert db.query(Appointment).count() == 1


def test_customer_sees_booking_in_their_own_list(api, db):
    customer = add_user(db, "c@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    staff_csrf = login(api, "staff@example.com")
    assert book(api, staff_csrf, customer.id, service.id, SLOT).status_code == 201
    login(api, "c@example.com")
    r = api.get("/appointments")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_unknown_customer_is_404(api, db):
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    csrf = login(api, "staff@example.com")
    r = book(api, csrf, uuid.uuid4(), service.id, SLOT)
    assert r.status_code == 404
    assert r.json()["detail"] == "Customer not found"


def test_inactive_customer_is_404(api, db):
    customer = add_user(db, "gone@example.com", active=False)
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    csrf = login(api, "staff@example.com")
    assert book(api, csrf, customer.id, service.id, SLOT).status_code == 404


def test_staff_target_is_404(api, db):
    target = add_user(db, "other.staff@example.com", role="staff")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    csrf = login(api, "staff@example.com")
    assert book(api, csrf, target.id, service.id, SLOT).status_code == 404


def test_unknown_service_is_404(api, db):
    customer = add_user(db, "c@example.com")
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    r = book(api, csrf, customer.id, uuid.uuid4(), SLOT)
    assert r.status_code == 404
    assert r.json()["detail"] == "Service not found"


def test_taken_slot_is_409(api, db):
    customer = add_user(db, "c@example.com")
    other = add_user(db, "o@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    add_appt(db, other, service, SLOT)
    csrf = login(api, "staff@example.com")
    assert book(api, csrf, customer.id, service.id, SLOT).status_code == 409
    assert db.query(Appointment).count() == 1


def test_closed_time_is_422(api, db):
    customer = add_user(db, "c@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    csrf = login(api, "staff@example.com")
    assert book(api, csrf, customer.id, service.id, CLOSED).status_code == 422
    assert db.query(Appointment).count() == 0


def test_missing_customer_id_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    csrf = login(api, "staff@example.com")
    r = api.post(
        "/staff/appointments",
        json={"service_id": str(service.id), "starts_at": SLOT.isoformat()},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 422


def test_extra_fields_are_rejected(api, db):
    customer = add_user(db, "c@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    csrf = login(api, "staff@example.com")
    r = book(api, csrf, customer.id, service.id, SLOT, created_by_id=str(uuid.uuid4()))
    assert r.status_code == 422
    assert db.query(Appointment).count() == 0
    