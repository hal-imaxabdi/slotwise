from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.config import settings
from app.deps import get_now
from app.main import app
from app.models import Appointment, Service, User
from app.security.passwords import hash_password

NOW = datetime(2026, 11, 4, 3, 0, tzinfo=UTC)
EMAIL = "leaving@example.com"
PW = "a-long-enough-password"


@pytest.fixture()
def api(client):
    app.dependency_overrides[get_now] = lambda: NOW
    yield client
    app.dependency_overrides.pop(get_now, None)


def add_user(db, email=EMAIL, role="customer"):
    user = User(email=email, full_name="Leaving Customer", role=role,
                password_hash=hash_password(PW))
    db.add(user)
    db.commit()
    return user


def add_appointment(db, user, starts_at, status="booked"):
    service = db.scalar(select(Service)) or Service(name="Cut", duration_minutes=30)
    db.add(service)
    db.flush()
    appt = Appointment(customer_id=user.id, service_id=service.id, created_by_id=user.id,
                       starts_at=starts_at, ends_at=starts_at + timedelta(minutes=30),
                       status=status, notes="call me on 0812")
    db.add(appt)
    db.commit()
    return appt


def sign_in(api, email=EMAIL):
    r = api.post("/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200
    return {"X-CSRF-Token": r.json()["csrf_token"]}


def delete(api, headers, password=PW):
    return api.post("/auth/delete-account", headers=headers, json={"password": password})


def test_delete_anonymises_and_signs_out(api, db):
    user = add_user(db)
    headers = sign_in(api)
    assert delete(api, headers).status_code == 204

    db.expire_all()
    row = db.get(User, user.id)
    assert row.email == f"deleted-{user.id}@deleted.invalid"
    assert row.full_name == "Deleted customer"
    assert row.is_active is False
    assert api.get("/auth/me").status_code == 401
    assert api.post("/auth/login", json={"email": EMAIL, "password": PW}).status_code == 401


def test_delete_cancels_future_bookings_and_clears_notes(api, db):
    user = add_user(db)
    past = add_appointment(db, user, NOW - timedelta(days=2), status="completed")
    future = add_appointment(db, user, NOW + timedelta(days=2))
    assert delete(api, sign_in(api)).status_code == 204

    db.expire_all()
    assert db.get(Appointment, past.id).status == "completed"
    assert db.get(Appointment, future.id).status == "cancelled"
    assert db.get(Appointment, future.id).cancelled_at is not None
    assert {db.get(Appointment, past.id).notes, db.get(Appointment, future.id).notes} == {""}


def test_email_can_be_registered_again_after_delete(api, db):
    add_user(db)
    assert delete(api, sign_in(api)).status_code == 204
    r = api.post("/auth/register", json={"full_name": "Back Again", "email": EMAIL,
                                         "password": PW})
    assert r.status_code == 201


def test_wrong_password_is_refused_and_counted(api, db):
    user = add_user(db)
    headers = sign_in(api)
    for _ in range(5):
        assert delete(api, headers, "wrong-password").status_code == 400
    assert delete(api, headers).status_code == 429
    db.expire_all()
    assert db.get(User, user.id).is_active is True


def test_requires_csrf(api, db):
    add_user(db)
    sign_in(api)
    assert delete(api, {}).status_code == 403


def test_staff_cannot_delete_themselves(api, db):
    add_user(db, email="barber@example.com", role="staff")
    r = delete(api, sign_in(api, "barber@example.com"))
    assert r.status_code == 403


def test_demo_customer_cannot_delete_the_shared_account(api, db, monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", True)
    add_user(db, email="demo.customer@example.com")
    r = delete(api, sign_in(api, "demo.customer@example.com"))
    assert r.status_code == 403
