import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.deps import get_now
from app.main import app
from app.models import Appointment, Service, User
from app.security.passwords import hash_password

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=UTC)
PW = "correct horse battery staple"
SLOT = datetime(2026, 11, 2, 2, 30, tzinfo=UTC)  # Mon 09:30 Jakarta (Nov 2)
LATE_NIGHT = datetime(2026, 11, 2, 16, 30, tzinfo=UTC)  # Nov 2 23:30 Jakarta
NEXT_DAY = datetime(2026, 11, 2, 17, 30, tzinfo=UTC)  # Nov 3 00:30 Jakarta


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


def add_service(db, name: str = "Haircut") -> Service:
    service = Service(
        name=name,
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


def ids(response) -> list[str]:
    return [item["id"] for item in response.json()]


def test_requires_login(api):
    assert api.get("/staff/appointments").status_code == 401


def test_customer_role_is_403(api, db):
    add_user(db, "c@example.com")
    login(api, "c@example.com")
    assert api.get("/staff/appointments").status_code == 403


@pytest.mark.parametrize("role", ["staff", "admin"])
def test_staff_or_admin_sees_all_with_customer_details(api, db, role):
    alice = add_user(db, "alice@example.com")
    bob = add_user(db, "bob@example.com")
    add_user(db, "actor@example.com", role=role)
    service = add_service(db)
    add_appt(db, alice, service, SLOT)
    add_appt(db, bob, service, SLOT + timedelta(hours=1))
    login(api, "actor@example.com")
    r = api.get("/staff/appointments")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    emails = {item["customer_email"] for item in body}
    assert emails == {"alice@example.com", "bob@example.com"}
    first = next(i for i in body if i["customer_email"] == "alice@example.com")
    assert first["customer_name"] == "alice"
    assert first["customer_id"] == str(alice.id)
    assert first["created_by_id"] == str(alice.id)


def test_empty_list_is_200(api, db):
    add_user(db, "staff@example.com", role="staff")
    login(api, "staff@example.com")
    r = api.get("/staff/appointments")
    assert r.status_code == 200
    assert r.json() == []


def test_newest_start_first(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    early = add_appt(db, owner, service, SLOT)
    late = add_appt(db, owner, service, SLOT + timedelta(hours=2))
    mid = add_appt(db, owner, service, SLOT + timedelta(hours=1))
    login(api, "staff@example.com")
    assert ids(api.get("/staff/appointments")) == [str(late.id), str(mid.id), str(early.id)]


def test_filter_by_status(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    booked = add_appt(db, owner, service, SLOT)
    add_appt(db, owner, service, SLOT + timedelta(hours=1), status="cancelled")
    login(api, "staff@example.com")
    r = api.get("/staff/appointments", params={"status": "booked"})
    assert ids(r) == [str(booked.id)]


def test_invalid_status_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    login(api, "staff@example.com")
    assert api.get("/staff/appointments", params={"status": "nope"}).status_code == 422


def test_filter_by_service(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    cut = add_service(db, "Haircut")
    shave = add_service(db, "Shave")
    wanted = add_appt(db, owner, cut, SLOT)
    add_appt(db, owner, shave, SLOT + timedelta(hours=1))
    login(api, "staff@example.com")
    r = api.get("/staff/appointments", params={"service_id": str(cut.id)})
    assert ids(r) == [str(wanted.id)]


def test_filter_by_customer(api, db):
    alice = add_user(db, "alice@example.com")
    bob = add_user(db, "bob@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    wanted = add_appt(db, alice, service, SLOT)
    add_appt(db, bob, service, SLOT + timedelta(hours=1))
    login(api, "staff@example.com")
    r = api.get("/staff/appointments", params={"customer_id": str(alice.id)})
    assert ids(r) == [str(wanted.id)]


def test_date_filter_uses_jakarta_days_not_utc_days(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    morning = add_appt(db, owner, service, SLOT)  # Nov 2 local
    night = add_appt(db, owner, service, LATE_NIGHT)  # Nov 2 local (23:30)
    next_day = add_appt(db, owner, service, NEXT_DAY)  # Nov 3 local, though Nov 2 in UTC
    login(api, "staff@example.com")

    nov2 = api.get("/staff/appointments", params={"from": "2026-11-02", "to": "2026-11-02"})
    assert sorted(ids(nov2)) == sorted([str(morning.id), str(night.id)])

    nov3 = api.get("/staff/appointments", params={"from": "2026-11-03", "to": "2026-11-03"})
    assert ids(nov3) == [str(next_day.id)]


def test_from_only_and_to_only(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    nov2 = add_appt(db, owner, service, SLOT)
    nov3 = add_appt(db, owner, service, NEXT_DAY)
    login(api, "staff@example.com")
    assert ids(api.get("/staff/appointments", params={"from": "2026-11-03"})) == [str(nov3.id)]
    assert ids(api.get("/staff/appointments", params={"to": "2026-11-02"})) == [str(nov2.id)]


def test_from_after_to_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    login(api, "staff@example.com")
    r = api.get("/staff/appointments", params={"from": "2026-11-05", "to": "2026-11-02"})
    assert r.status_code == 422


def test_bad_date_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    login(api, "staff@example.com")
    assert api.get("/staff/appointments", params={"from": "not-a-date"}).status_code == 422


def test_pagination_limit_and_offset(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    appts = [add_appt(db, owner, service, SLOT + timedelta(hours=h)) for h in range(5)]
    newest_first = [str(a.id) for a in reversed(appts)]
    login(api, "staff@example.com")
    page1 = api.get("/staff/appointments", params={"limit": 2, "offset": 0})
    page2 = api.get("/staff/appointments", params={"limit": 2, "offset": 2})
    page3 = api.get("/staff/appointments", params={"limit": 2, "offset": 4})
    assert ids(page1) == newest_first[0:2]
    assert ids(page2) == newest_first[2:4]
    assert ids(page3) == newest_first[4:5]


@pytest.mark.parametrize(
    "params",
    [{"limit": 0}, {"limit": 201}, {"offset": -1}, {"limit": "abc"}],
)
def test_bad_pagination_is_422(api, db, params):
    add_user(db, "staff@example.com", role="staff")
    login(api, "staff@example.com")
    assert api.get("/staff/appointments", params=params).status_code == 422


def test_unknown_filter_ids_return_empty_not_error(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    add_appt(db, owner, add_service(db), SLOT)
    login(api, "staff@example.com")
    r = api.get("/staff/appointments", params={"customer_id": str(uuid.uuid4())})
    assert r.status_code == 200
    assert r.json() == []
    