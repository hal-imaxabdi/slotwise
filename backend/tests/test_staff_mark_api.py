import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.deps import get_now
from app.main import app
from app.models import Appointment, Service, User
from app.security.passwords import hash_password

NOW = datetime(2026, 11, 2, 10, 0, tzinfo=UTC)
PW = "correct horse battery staple"
PAST = NOW - timedelta(hours=2)
FUTURE = NOW + timedelta(hours=2)


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


def add_service(db) -> Service:
    service = Service(
        name="Haircut",
        description="test service",
        duration_minutes=30,
        price_idr=50000,
        is_active=True,
    )
    db.add(service)
    db.commit()
    return service


def add_appt(
    db, owner: User, service: Service, start: datetime, status: str = "booked"
) -> Appointment:
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


def login(api, email: str) -> str:
    r = api.post("/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200
    return r.json()["csrf_token"]


def mark(api, csrf: str | None, appt_id, action: str):
    headers = {"X-CSRF-Token": csrf} if csrf else {}
    return api.post(f"/staff/appointments/{appt_id}/{action}", headers=headers)


ACTIONS = [("complete", "completed"), ("no-show", "no_show")]


@pytest.mark.parametrize("action", ["complete", "no-show"])
def test_requires_login(api, action):
    assert mark(api, "x" * 43, uuid.uuid4(), action).status_code == 401


@pytest.mark.parametrize("action", ["complete", "no-show"])
def test_without_csrf_is_403(api, db, action):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    appt = add_appt(db, owner, add_service(db), PAST)
    login(api, "staff@example.com")
    assert mark(api, None, appt.id, action).status_code == 403
    db.refresh(appt)
    assert appt.status == "booked"


@pytest.mark.parametrize("action", ["complete", "no-show"])
def test_customer_role_is_403_even_for_own_appointment(api, db, action):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), PAST)
    csrf = login(api, "a@example.com")
    assert mark(api, csrf, appt.id, action).status_code == 403
    db.refresh(appt)
    assert appt.status == "booked"


@pytest.mark.parametrize("role", ["staff", "admin"])
@pytest.mark.parametrize("action,expected", ACTIONS)
def test_staff_or_admin_marks_past_appointment(api, db, role, action, expected):
    owner = add_user(db, "a@example.com")
    add_user(db, "actor@example.com", role=role)
    appt = add_appt(db, owner, add_service(db), PAST)
    csrf = login(api, "actor@example.com")
    r = mark(api, csrf, appt.id, action)
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == str(appt.id)
    assert body["status"] == expected
    assert body["customer_id"] == str(owner.id)
    db.refresh(appt)
    assert appt.status == expected


@pytest.mark.parametrize("action,expected", ACTIONS)
def test_marking_twice_is_200(api, db, action, expected):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    appt = add_appt(db, owner, add_service(db), PAST)
    csrf = login(api, "staff@example.com")
    assert mark(api, csrf, appt.id, action).status_code == 200
    r = mark(api, csrf, appt.id, action)
    assert r.status_code == 200
    assert r.json()["status"] == expected


@pytest.mark.parametrize("action", ["complete", "no-show"])
def test_future_appointment_is_409(api, db, action):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    appt = add_appt(db, owner, add_service(db), FUTURE)
    csrf = login(api, "staff@example.com")
    r = mark(api, csrf, appt.id, action)
    assert r.status_code == 409
    assert r.json()["detail"] == "Appointment has not started yet"
    db.refresh(appt)
    assert appt.status == "booked"


@pytest.mark.parametrize("action", ["complete", "no-show"])
def test_cancelled_appointment_is_409(api, db, action):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    appt = add_appt(db, owner, add_service(db), PAST, status="cancelled")
    csrf = login(api, "staff@example.com")
    assert mark(api, csrf, appt.id, action).status_code == 409
    db.refresh(appt)
    assert appt.status == "cancelled"


def test_completed_cannot_become_no_show(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    appt = add_appt(db, owner, add_service(db), PAST, status="completed")
    csrf = login(api, "staff@example.com")
    assert mark(api, csrf, appt.id, "no-show").status_code == 409
    db.refresh(appt)
    assert appt.status == "completed"


@pytest.mark.parametrize("action", ["complete", "no-show"])
def test_unknown_id_is_404(api, db, action):
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    assert mark(api, csrf, uuid.uuid4(), action).status_code == 404


def test_bad_uuid_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    assert mark(api, csrf, "not-a-uuid", "complete").status_code == 422
    