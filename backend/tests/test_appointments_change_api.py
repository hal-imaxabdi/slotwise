import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.deps import get_now
from app.main import app
from app.models import Appointment, BusinessHour, Service, User
from app.security.passwords import hash_password

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=UTC)
PW = "correct horse battery staple"
SLOT = datetime(2026, 11, 2, 2, 30, tzinfo=UTC)  # Mon 09:30 Jakarta, > 24h away
NEW_SLOT = datetime(2026, 11, 2, 3, 30, tzinfo=UTC)  # Mon 10:30 Jakarta
CLOSED = datetime(2026, 11, 2, 5, 0, tzinfo=UTC)  # Mon 12:00 Jakarta (closed)
SOON = NOW + timedelta(hours=1)  # inside the 24h window


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


def add_appt(
    db, owner: User, service: Service, start: datetime, status: str = "booked"
) -> Appointment:
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


def login(api, email: str) -> str:
    r = api.post("/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200
    return r.json()["csrf_token"]


def cancel(api, csrf: str, appt_id):
    return api.post(f"/appointments/{appt_id}/cancel", headers={"X-CSRF-Token": csrf})


def resched(api, csrf: str, appt_id, start: datetime, **extra):
    return api.post(
        f"/appointments/{appt_id}/reschedule",
        json={"starts_at": start.isoformat(), **extra},
        headers={"X-CSRF-Token": csrf},
    )


def test_cancel_requires_login(api):
    assert cancel(api, "x" * 43, uuid.uuid4()).status_code == 401


def test_cancel_without_csrf_is_403(api, db):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT)
    login(api, "a@example.com")
    assert api.post(f"/appointments/{appt.id}/cancel").status_code == 403
    db.refresh(appt)
    assert appt.status == "booked"


def test_cancel_own_returns_200_and_marks_cancelled(api, db):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT)
    csrf = login(api, "a@example.com")
    r = cancel(api, csrf, appt.id)
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == str(appt.id)
    assert body["status"] == "cancelled"
    assert datetime.fromisoformat(body["cancelled_at"]) == NOW
    db.refresh(appt)
    assert appt.status == "cancelled"
    assert appt.cancelled_by_id == owner.id


def test_cancel_other_users_appointment_is_404(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "b@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT)
    csrf = login(api, "b@example.com")
    assert cancel(api, csrf, appt.id).status_code == 404
    db.refresh(appt)
    assert appt.status == "booked"


def test_cancel_unknown_id_is_404(api, db):
    add_user(db, "a@example.com")
    csrf = login(api, "a@example.com")
    assert cancel(api, csrf, uuid.uuid4()).status_code == 404


def test_customer_cancel_inside_24h_is_403(api, db):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), SOON)
    csrf = login(api, "a@example.com")
    assert cancel(api, csrf, appt.id).status_code == 403
    db.refresh(appt)
    assert appt.status == "booked"


def test_staff_cancel_inside_24h_is_200(api, db):
    owner = add_user(db, "a@example.com")
    staff = add_user(db, "staff@example.com", role="staff")
    appt = add_appt(db, owner, add_service(db), SOON)
    csrf = login(api, "staff@example.com")
    r = cancel(api, csrf, appt.id)
    assert r.status_code == 200
    db.refresh(appt)
    assert appt.status == "cancelled"
    assert appt.cancelled_by_id == staff.id
    assert appt.customer_id == owner.id


def test_cancel_twice_is_200_both_times(api, db):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT)
    csrf = login(api, "a@example.com")
    assert cancel(api, csrf, appt.id).status_code == 200
    r = cancel(api, csrf, appt.id)
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


def test_cancel_completed_is_409(api, db):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT, status="completed")
    csrf = login(api, "a@example.com")
    assert cancel(api, csrf, appt.id).status_code == 409
    db.refresh(appt)
    assert appt.status == "completed"


def test_reschedule_own_returns_200(api, db):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT)
    csrf = login(api, "a@example.com")
    r = resched(api, csrf, appt.id, NEW_SLOT)
    assert r.status_code == 200
    body = r.json()
    assert datetime.fromisoformat(body["starts_at"]) == NEW_SLOT
    assert datetime.fromisoformat(body["ends_at"]) == NEW_SLOT + timedelta(minutes=30)
    assert body["status"] == "booked"
    db.refresh(appt)
    assert appt.starts_at == NEW_SLOT


def test_reschedule_without_csrf_is_403(api, db):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT)
    login(api, "a@example.com")
    r = api.post(
        f"/appointments/{appt.id}/reschedule", json={"starts_at": NEW_SLOT.isoformat()}
    )
    assert r.status_code == 403
    db.refresh(appt)
    assert appt.starts_at == SLOT


def test_reschedule_other_users_appointment_is_404(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "b@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT)
    csrf = login(api, "b@example.com")
    assert resched(api, csrf, appt.id, NEW_SLOT).status_code == 404
    db.refresh(appt)
    assert appt.starts_at == SLOT


def test_reschedule_to_taken_slot_is_409(api, db):
    owner = add_user(db, "a@example.com")
    other = add_user(db, "b@example.com")
    service = add_service(db)
    appt = add_appt(db, owner, service, SLOT)
    add_appt(db, other, service, NEW_SLOT)
    csrf = login(api, "a@example.com")
    assert resched(api, csrf, appt.id, NEW_SLOT).status_code == 409
    db.refresh(appt)
    assert appt.starts_at == SLOT


def test_reschedule_to_closed_time_is_422(api, db):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT)
    csrf = login(api, "a@example.com")
    assert resched(api, csrf, appt.id, CLOSED).status_code == 422
    db.refresh(appt)
    assert appt.starts_at == SLOT


def test_customer_reschedule_inside_24h_is_403(api, db):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), SOON)
    csrf = login(api, "a@example.com")
    assert resched(api, csrf, appt.id, NEW_SLOT).status_code == 403
    db.refresh(appt)
    assert appt.starts_at == SOON


def test_reschedule_rejects_extra_fields(api, db):
    owner = add_user(db, "a@example.com")
    other = add_user(db, "b@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT)
    csrf = login(api, "a@example.com")
    r = resched(api, csrf, appt.id, NEW_SLOT, customer_id=str(other.id))
    assert r.status_code == 422
    db.refresh(appt)
    assert appt.starts_at == SLOT
    assert appt.customer_id == owner.id


def test_reschedule_cancelled_appointment_is_409(api, db):
    owner = add_user(db, "a@example.com")
    appt = add_appt(db, owner, add_service(db), SLOT, status="cancelled")
    csrf = login(api, "a@example.com")
    assert resched(api, csrf, appt.id, NEW_SLOT).status_code == 409
    db.refresh(appt)
    assert appt.starts_at == SLOT
    