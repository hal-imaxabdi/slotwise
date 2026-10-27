import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.deps import get_now
from app.main import app
from app.models import Appointment, Service, UnavailablePeriod, User
from app.security.passwords import hash_password

NOW = datetime(2026, 11, 2, 10, 0, tzinfo=UTC)
PW = "correct horse battery staple"
P_START = datetime(2026, 11, 3, 2, 0, tzinfo=UTC)  # Tue 09:00 Jakarta
P_END = P_START + timedelta(hours=3)
URL = "/staff/unavailable-periods"


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


def add_period(
    db, creator: User, start: datetime, end: datetime, reason: str = "Closed"
) -> UnavailablePeriod:
    period = UnavailablePeriod(
        starts_at=start, ends_at=end, reason=reason, created_by_id=creator.id
    )
    db.add(period)
    db.commit()
    return period


def count_periods(db) -> int:
    return db.scalar(select(func.count()).select_from(UnavailablePeriod))


def login(api, email: str) -> str:
    r = api.post("/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200
    return r.json()["csrf_token"]


def payload(**overrides) -> dict:
    data = {
        "starts_at": P_START.isoformat(),
        "ends_at": P_END.isoformat(),
        "reason": "Public holiday",
    }
    data.update(overrides)
    return data


def post_period(api, csrf: str | None, data: dict):
    headers = {"X-CSRF-Token": csrf} if csrf else {}
    return api.post(URL, json=data, headers=headers)


def remove(api, csrf: str | None, period_id):
    headers = {"X-CSRF-Token": csrf} if csrf else {}
    return api.delete(f"{URL}/{period_id}", headers=headers)


# ---------- POST ----------


def test_create_requires_login(api):
    assert post_period(api, "x" * 43, payload()).status_code == 401


def test_create_without_csrf_is_403(api, db):
    add_user(db, "staff@example.com", role="staff")
    login(api, "staff@example.com")
    assert post_period(api, None, payload()).status_code == 403
    assert count_periods(db) == 0


def test_create_as_customer_is_403(api, db):
    add_user(db, "a@example.com")
    csrf = login(api, "a@example.com")
    assert post_period(api, csrf, payload()).status_code == 403
    assert count_periods(db) == 0


@pytest.mark.parametrize("role", ["staff", "admin"])
def test_staff_or_admin_creates_period(api, db, role):
    actor = add_user(db, "actor@example.com", role=role)
    csrf = login(api, "actor@example.com")
    r = post_period(api, csrf, payload(reason="  Public holiday  "))
    assert r.status_code == 201
    body = r.json()
    assert body["reason"] == "Public holiday"
    assert datetime.fromisoformat(body["starts_at"]) == P_START
    assert datetime.fromisoformat(body["ends_at"]) == P_END
    assert body["created_by_id"] == str(actor.id)
    assert count_periods(db) == 1


def test_extra_field_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    r = post_period(api, csrf, payload(created_by_id=str(uuid.uuid4())))
    assert r.status_code == 422
    assert count_periods(db) == 0


def test_naive_datetime_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    r = post_period(api, csrf, payload(starts_at="2026-11-03T09:00:00"))
    assert r.status_code == 422
    assert count_periods(db) == 0


@pytest.mark.parametrize("reason", ["", "   ", "x" * 201])
def test_invalid_reason_is_422(api, db, reason):
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    assert post_period(api, csrf, payload(reason=reason)).status_code == 422
    assert count_periods(db) == 0


def test_missing_reason_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    data = payload()
    del data["reason"]
    assert post_period(api, csrf, data).status_code == 422
    assert count_periods(db) == 0


def test_end_before_start_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    r = post_period(
        api,
        csrf,
        payload(starts_at=P_END.isoformat(), ends_at=P_START.isoformat()),
    )
    assert r.status_code == 422
    assert count_periods(db) == 0


def test_off_grid_time_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    off_grid = (P_START + timedelta(minutes=15)).isoformat()
    assert post_period(api, csrf, payload(starts_at=off_grid)).status_code == 422
    assert count_periods(db) == 0


def test_conflict_is_409_with_count(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "staff@example.com", role="staff")
    service = add_service(db)
    add_appt(db, owner, service, P_START)
    add_appt(db, owner, service, P_START + timedelta(minutes=30))
    add_appt(db, owner, service, P_START + timedelta(minutes=60), status="cancelled")
    add_appt(db, owner, service, P_END)  # touches the edge: no conflict
    csrf = login(api, "staff@example.com")
    r = post_period(api, csrf, payload())
    assert r.status_code == 409
    assert "2 active appointment" in r.json()["detail"]
    assert count_periods(db) == 0


# ---------- GET ----------


def test_list_requires_login(api):
    assert api.get(URL).status_code == 401


def test_list_as_customer_is_403(api, db):
    add_user(db, "a@example.com")
    login(api, "a@example.com")
    assert api.get(URL).status_code == 403


def test_list_is_newest_first_with_paging(api, db):
    staff = add_user(db, "staff@example.com", role="staff")
    periods = [
        add_period(
            db,
            staff,
            P_START + timedelta(days=i),
            P_START + timedelta(days=i, hours=1),
        )
        for i in range(3)
    ]
    oldest, middle, newest = (str(p.id) for p in periods)
    login(api, "staff@example.com")

    r = api.get(URL, params={"limit": 2})
    assert r.status_code == 200
    assert [p["id"] for p in r.json()] == [newest, middle]

    r = api.get(URL, params={"limit": 2, "offset": 2})
    assert [p["id"] for p in r.json()] == [oldest]


def test_list_date_filter_uses_jakarta_days(api, db):
    staff = add_user(db, "staff@example.com", role="staff")
    periods = [
        add_period(
            db,
            staff,
            P_START + timedelta(days=i),
            P_START + timedelta(days=i, hours=1),
        )
        for i in range(3)
    ]
    middle = str(periods[1].id)
    login(api, "staff@example.com")
    r = api.get(URL, params={"from": "2026-11-04", "to": "2026-11-04"})
    assert r.status_code == 200
    assert [p["id"] for p in r.json()] == [middle]


def test_list_from_after_to_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    login(api, "staff@example.com")
    r = api.get(URL, params={"from": "2026-11-05", "to": "2026-11-04"})
    assert r.status_code == 422


@pytest.mark.parametrize("limit", [0, 201])
def test_list_limit_out_of_range_is_422(api, db, limit):
    add_user(db, "staff@example.com", role="staff")
    login(api, "staff@example.com")
    assert api.get(URL, params={"limit": limit}).status_code == 422


# ---------- DELETE ----------


def test_delete_requires_login(api):
    assert remove(api, "x" * 43, uuid.uuid4()).status_code == 401


def test_delete_without_csrf_is_403(api, db):
    staff = add_user(db, "staff@example.com", role="staff")
    period = add_period(db, staff, P_START, P_END)
    login(api, "staff@example.com")
    assert remove(api, None, period.id).status_code == 403
    assert count_periods(db) == 1


def test_delete_as_customer_is_403(api, db):
    staff = add_user(db, "staff@example.com", role="staff")
    add_user(db, "a@example.com")
    period = add_period(db, staff, P_START, P_END)
    csrf = login(api, "a@example.com")
    assert remove(api, csrf, period.id).status_code == 403
    assert count_periods(db) == 1


@pytest.mark.parametrize("role", ["staff", "admin"])
def test_staff_or_admin_deletes_period(api, db, role):
    actor = add_user(db, "actor@example.com", role=role)
    period = add_period(db, actor, P_START, P_END)
    csrf = login(api, "actor@example.com")
    r = remove(api, csrf, period.id)
    assert r.status_code == 204
    assert r.content == b""
    assert count_periods(db) == 0


def test_delete_unknown_id_is_404(api, db):
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    assert remove(api, csrf, uuid.uuid4()).status_code == 404


def test_delete_bad_uuid_is_422(api, db):
    add_user(db, "staff@example.com", role="staff")
    csrf = login(api, "staff@example.com")
    assert remove(api, csrf, "not-a-uuid").status_code == 422


def test_deleting_twice_is_404_the_second_time(api, db):
    staff = add_user(db, "staff@example.com", role="staff")
    period = add_period(db, staff, P_START, P_END)
    csrf = login(api, "staff@example.com")
    assert remove(api, csrf, period.id).status_code == 204
    assert remove(api, csrf, period.id).status_code == 404
    