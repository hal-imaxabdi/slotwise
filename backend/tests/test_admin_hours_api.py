from datetime import UTC, datetime, timedelta

import pytest

from app.deps import get_now
from app.main import app
from app.models import Appointment, BusinessHour, Service, User
from app.security.passwords import hash_password

NOW = datetime(2026, 11, 2, 10, 0, tzinfo=UTC)  # Monday 17:00 Jakarta
TUE_9_JAKARTA = datetime(2026, 11, 3, 2, 0, tzinfo=UTC)  # Tuesday 09:00 Jakarta
PW = "correct horse battery staple"
URL = "/admin/business-hours"


def iv(open_minute, close_minute) -> dict:
    return {"open_minute": open_minute, "close_minute": close_minute}


def body(*pairs) -> dict:
    return {"intervals": [iv(o, c) for o, c in pairs]}


CASES = [
    ("GET", URL, None),
    ("PUT", f"{URL}/1", body((540, 720))),
]


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


def add_hour(db, weekday: int, open_minute: int, close_minute: int) -> BusinessHour:
    hour = BusinessHour(weekday=weekday, open_minute=open_minute, close_minute=close_minute)
    db.add(hour)
    db.commit()
    return hour


def add_appt(db, owner: User, service: Service, start: datetime) -> Appointment:
    appt = Appointment(
        customer_id=owner.id,
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(minutes=30),
        status="booked",
        created_by_id=owner.id,
    )
    db.add(appt)
    db.commit()
    return appt


def login(api, email: str) -> str:
    r = api.post("/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200
    return r.json()["csrf_token"]


def send(api, method: str, url: str, csrf: str | None = None, payload=None):
    headers = {"X-CSRF-Token": csrf} if csrf else {}
    return api.request(method, url, json=payload, headers=headers)


def as_admin(api, db) -> str:
    add_user(db, "admin@example.com", role="admin")
    return login(api, "admin@example.com")


def pairs(rows: list[dict]) -> list[tuple[int, int, int]]:
    return [(r["weekday"], r["open_minute"], r["close_minute"]) for r in rows]


# ---------- access control ----------


@pytest.mark.parametrize("method,url,payload", CASES)
def test_requires_login(api, method, url, payload):
    assert send(api, method, url, "x" * 43, payload).status_code == 401


@pytest.mark.parametrize("role", ["customer", "staff"])
@pytest.mark.parametrize("method,url,payload", CASES)
def test_non_admin_is_403(api, db, role, method, url, payload):
    add_user(db, "actor@example.com", role=role)
    csrf = login(api, "actor@example.com")
    assert send(api, method, url, csrf, payload).status_code == 403


def test_put_without_csrf_is_403_and_changes_nothing(api, db):
    as_admin(api, db)
    add_hour(db, 1, 540, 720)
    assert send(api, "PUT", f"{URL}/1", None, body((600, 900))).status_code == 403
    assert pairs(api.get(URL).json()) == [(1, 540, 720)]


# ---------- GET ----------


def test_get_is_empty_when_no_hours_exist(api, db):
    as_admin(api, db)
    r = api.get(URL)
    assert r.status_code == 200
    assert r.json() == []


def test_get_is_ordered_by_weekday_then_opening_time(api, db):
    as_admin(api, db)
    add_hour(db, 2, 540, 720)
    add_hour(db, 0, 780, 1020)
    add_hour(db, 0, 540, 720)
    rows = api.get(URL).json()
    assert pairs(rows) == [(0, 540, 720), (0, 780, 1020), (2, 540, 720)]
    assert set(rows[0]) == {"id", "weekday", "open_minute", "close_minute"}


# ---------- PUT ----------


def test_put_sets_a_days_hours(api, db):
    csrf = as_admin(api, db)
    r = send(api, "PUT", f"{URL}/1", csrf, body((540, 720), (780, 1020)))
    assert r.status_code == 200
    assert pairs(r.json()) == [(1, 540, 720), (1, 780, 1020)]
    assert pairs(api.get(URL).json()) == [(1, 540, 720), (1, 780, 1020)]


def test_put_input_order_does_not_matter(api, db):
    csrf = as_admin(api, db)
    r = send(api, "PUT", f"{URL}/1", csrf, body((780, 1020), (540, 720)))
    assert r.status_code == 200
    assert pairs(r.json()) == [(1, 540, 720), (1, 780, 1020)]


def test_put_replaces_only_that_day(api, db):
    csrf = as_admin(api, db)
    add_hour(db, 1, 540, 720)
    add_hour(db, 2, 540, 720)
    r = send(api, "PUT", f"{URL}/1", csrf, body((600, 900)))
    assert r.status_code == 200
    assert pairs(api.get(URL).json()) == [(1, 600, 900), (2, 540, 720)]


def test_put_empty_list_closes_the_day(api, db):
    csrf = as_admin(api, db)
    add_hour(db, 1, 540, 720)
    r = send(api, "PUT", f"{URL}/1", csrf, {"intervals": []})
    assert r.status_code == 200
    assert r.json() == []
    assert api.get(URL).json() == []


def test_put_same_hours_keeps_the_same_rows(api, db):
    csrf = as_admin(api, db)
    add_hour(db, 1, 540, 720)
    before = api.get(URL).json()
    r = send(api, "PUT", f"{URL}/1", csrf, body((540, 720)))
    assert r.status_code == 200
    assert r.json() == before


BAD_BODIES = [
    pytest.param(body((545, 720)), id="off-grid-open"),
    pytest.param(body((540, 725)), id="off-grid-close"),
    pytest.param(body((720, 540)), id="reversed"),
    pytest.param(body((600, 600)), id="zero-length"),
    pytest.param(body((-30, 60)), id="negative-open"),
    pytest.param(body((1380, 1470)), id="past-midnight"),
    pytest.param(body((540, 720), (690, 900)), id="overlap"),
    pytest.param(
        {"intervals": [iv(i * 60, i * 60 + 30) for i in range(9)]}, id="nine-intervals"
    ),
    pytest.param(
        {"intervals": [iv(i * 60, i * 60 + 30) for i in range(21)]}, id="twenty-one-intervals"
    ),
    pytest.param({"intervals": [iv("540", 720)]}, id="string-minute"),
    pytest.param({"intervals": [iv(True, 720)]}, id="bool-minute"),
    pytest.param({"intervals": [iv(540.5, 720)]}, id="float-minute"),
    pytest.param({"intervals": [{**iv(540, 720), "extra": 1}]}, id="extra-field-in-interval"),
    pytest.param({"intervals": [], "extra": 1}, id="extra-top-level-field"),
    pytest.param({}, id="missing-intervals"),
    pytest.param({"intervals": None}, id="null-intervals"),
]


@pytest.mark.parametrize("payload", BAD_BODIES)
def test_put_invalid_body_is_422_and_changes_nothing(api, db, payload):
    csrf = as_admin(api, db)
    add_hour(db, 1, 540, 720)
    assert send(api, "PUT", f"{URL}/1", csrf, payload).status_code == 422
    assert pairs(api.get(URL).json()) == [(1, 540, 720)]


@pytest.mark.parametrize("weekday", ["7", "-1", "x"])
def test_put_bad_weekday_is_422(api, db, weekday):
    csrf = as_admin(api, db)
    assert send(api, "PUT", f"{URL}/{weekday}", csrf, body((540, 720))).status_code == 422
    assert api.get(URL).json() == []


def test_put_conflicting_future_appointment_is_409_with_count(api, db):
    csrf = as_admin(api, db)
    owner = add_user(db, "a@example.com")
    add_hour(db, 1, 540, 720)
    add_appt(db, owner, add_service(db), TUE_9_JAKARTA)
    r = send(api, "PUT", f"{URL}/1", csrf, body((600, 1020)))
    assert r.status_code == 409
    assert "1 active appointment" in r.json()["detail"]
    assert pairs(api.get(URL).json()) == [(1, 540, 720)]


def test_put_appointment_that_still_fits_is_200(api, db):
    csrf = as_admin(api, db)
    owner = add_user(db, "a@example.com")
    add_appt(db, owner, add_service(db), TUE_9_JAKARTA)
    r = send(api, "PUT", f"{URL}/1", csrf, body((540, 720)))
    assert r.status_code == 200
    assert pairs(r.json()) == [(1, 540, 720)]


def test_new_hours_drive_the_public_slot_list(api, db):
    csrf = as_admin(api, db)
    service = add_service(db)
    slots_url = f"/services/{service.id}/slots"
    params = {"date": "2026-11-03"}  # a Tuesday

    assert api.get(slots_url, params=params).json()["slots"] == []

    assert send(api, "PUT", f"{URL}/1", csrf, body((540, 720))).status_code == 200
    assert len(api.get(slots_url, params=params).json()["slots"]) == 6  # 09:00-12:00, 30 min

    assert send(api, "PUT", f"{URL}/1", csrf, {"intervals": []}).status_code == 200
    assert api.get(slots_url, params=params).json()["slots"] == []
    