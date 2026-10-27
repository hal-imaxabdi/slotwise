import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.deps import get_now
from app.main import app
from app.models import Appointment, BusinessHour, Service, User
from app.security.passwords import hash_password

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=UTC)
PW = "correct horse battery staple"
SLOT = datetime(2026, 11, 2, 2, 30, tzinfo=UTC)  # Mon 09:30 Jakarta
SLOT_2 = datetime(2026, 11, 2, 3, 0, tzinfo=UTC)  # Mon 10:00 Jakarta
SLOT_3 = datetime(2026, 11, 2, 3, 30, tzinfo=UTC)  # Mon 10:30 Jakarta
CLOSED = datetime(2026, 11, 2, 5, 0, tzinfo=UTC)  # Mon 12:00 Jakarta (closed)


@pytest.fixture()
def api(client):
    app.dependency_overrides[get_now] = lambda: NOW
    yield client
    app.dependency_overrides.pop(get_now, None)


def add_user(db, email: str, role: str = "customer") -> User:
    user = User(
        email=email,
        password_hash=hash_password(PW),
        full_name=email.split("@")[0],
        role=role,
        is_active=True,
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


def book(api, csrf: str, service_id, start: datetime, **extra):
    body = {"service_id": str(service_id), "starts_at": start.isoformat(), **extra}
    return api.post("/appointments", json=body, headers={"X-CSRF-Token": csrf})


def count(db) -> int:
    return db.scalar(select(func.count()).select_from(Appointment))


def test_create_requires_login(api, db):
    service = add_service(db)
    assert book(api, "x" * 43, service.id, SLOT).status_code == 401
    assert count(db) == 0


def test_create_without_csrf_is_403(api, db):
    add_user(db, "a@example.com")
    service = add_service(db)
    login(api, "a@example.com")
    r = api.post(
        "/appointments",
        json={"service_id": str(service.id), "starts_at": SLOT.isoformat()},
    )
    assert r.status_code == 403
    assert count(db) == 0


def test_create_success_returns_201_and_saves_for_session_user(api, db):
    user = add_user(db, "a@example.com")
    service = add_service(db, duration=60)
    csrf = login(api, "a@example.com")
    r = book(api, csrf, service.id, SLOT, notes="trim please")
    assert r.status_code == 201
    body = r.json()
    assert body["service_id"] == str(service.id)
    assert body["status"] == "booked"
    assert body["notes"] == "trim please"
    assert body["cancelled_at"] is None
    assert datetime.fromisoformat(body["starts_at"]) == SLOT
    assert datetime.fromisoformat(body["ends_at"]) == SLOT + timedelta(minutes=60)
    assert "customer_id" not in body
    row = db.get(Appointment, uuid.UUID(body["id"]))
    assert row is not None
    assert row.customer_id == user.id


def test_create_rejects_customer_id_in_body(api, db):
    other = add_user(db, "other@example.com")
    add_user(db, "a@example.com")
    service = add_service(db)
    csrf = login(api, "a@example.com")
    r = book(api, csrf, service.id, SLOT, customer_id=str(other.id))
    assert r.status_code == 422
    assert count(db) == 0


def test_create_naive_datetime_is_422(api, db):
    add_user(db, "a@example.com")
    service = add_service(db)
    csrf = login(api, "a@example.com")
    r = api.post(
        "/appointments",
        json={"service_id": str(service.id), "starts_at": "2026-11-02T09:30:00"},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 422
    assert count(db) == 0


def test_create_same_slot_twice_is_409(api, db):
    add_user(db, "a@example.com")
    service = add_service(db)
    csrf = login(api, "a@example.com")
    assert book(api, csrf, service.id, SLOT).status_code == 201
    r = book(api, csrf, service.id, SLOT)
    assert r.status_code == 409
    assert count(db) == 1


def test_create_outside_hours_is_422(api, db):
    add_user(db, "a@example.com")
    service = add_service(db)
    csrf = login(api, "a@example.com")
    assert book(api, csrf, service.id, CLOSED).status_code == 422
    assert count(db) == 0


def test_create_unknown_service_is_404(api, db):
    add_user(db, "a@example.com")
    csrf = login(api, "a@example.com")
    assert book(api, csrf, uuid.uuid4(), SLOT).status_code == 404


def test_list_requires_login(api):
    assert api.get("/appointments").status_code == 401


def test_list_returns_only_own_newest_first(api, db):
    a = add_user(db, "a@example.com")
    b = add_user(db, "b@example.com")
    service = add_service(db)
    first = add_appt(db, a, service, SLOT)
    second = add_appt(db, a, service, SLOT_2)
    add_appt(db, b, service, SLOT_3)
    login(api, "a@example.com")
    r = api.get("/appointments")
    assert r.status_code == 200
    items = r.json()
    assert [i["id"] for i in items] == [str(second.id), str(first.id)]
    assert all("customer_id" not in i for i in items)
    