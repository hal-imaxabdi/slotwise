import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.booking import cancel_appointment
from app.deps import get_now
from app.main import app
from app.models import Appointment, Service, User
from app.security.passwords import hash_password

NOW = datetime(2026, 11, 2, 10, 0, tzinfo=UTC)
APPT_START = datetime(2026, 11, 10, 2, 0, tzinfo=UTC)  # well over 24h after NOW
PW = "correct horse battery staple"
URL = "/admin/services"
UNKNOWN = uuid.uuid4()
NEW = {"name": "Haircut", "duration_minutes": 30}

# (method, url, json body) for every admin endpoint
CASES = [
    ("GET", URL, None),
    ("POST", URL, NEW),
    ("PATCH", f"{URL}/{UNKNOWN}", {}),
    ("POST", f"{URL}/{UNKNOWN}/deactivate", None),
    ("POST", f"{URL}/{UNKNOWN}/activate", None),
]
WRITE_CASES = CASES[1:]


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


def add_service(
    db,
    name: str = "Haircut",
    *,
    active: bool = True,
    price_idr: int = 50000,
    description: str = "Old",
) -> Service:
    service = Service(
        name=name,
        description=description,
        duration_minutes=30,
        price_idr=price_idr,
        is_active=active,
    )
    db.add(service)
    db.commit()
    return service


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


def count_services(db) -> int:
    return db.scalar(select(func.count()).select_from(Service))


def login(api, email: str) -> str:
    r = api.post("/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200
    return r.json()["csrf_token"]


def send(api, method: str, url: str, csrf: str | None = None, body=None):
    headers = {"X-CSRF-Token": csrf} if csrf else {}
    return api.request(method, url, json=body, headers=headers)


# ---------- access control ----------


@pytest.mark.parametrize("method,url,body", CASES)
def test_requires_login(api, method, url, body):
    assert send(api, method, url, "x" * 43, body).status_code == 401


@pytest.mark.parametrize("role", ["customer", "staff"])
@pytest.mark.parametrize("method,url,body", CASES)
def test_non_admin_is_403(api, db, role, method, url, body):
    add_user(db, "actor@example.com", role=role)
    csrf = login(api, "actor@example.com")
    assert send(api, method, url, csrf, body).status_code == 403
    assert count_services(db) == 0


@pytest.mark.parametrize("method,url,body", WRITE_CASES)
def test_write_without_csrf_is_403(api, db, method, url, body):
    add_user(db, "admin@example.com", role="admin")
    login(api, "admin@example.com")
    assert send(api, method, url, None, body).status_code == 403
    assert count_services(db) == 0


# ---------- create ----------


def test_admin_creates_service(api, db):
    add_user(db, "admin@example.com", role="admin")
    csrf = login(api, "admin@example.com")
    r = send(
        api,
        "POST",
        URL,
        csrf,
        {
            "name": "  Haircut ",
            "description": "Cut and style",
            "duration_minutes": 60,
            "price_idr": 75000,
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert uuid.UUID(body["id"])
    assert body["name"] == "Haircut"
    assert body["description"] == "Cut and style"
    assert body["duration_minutes"] == 60
    assert body["price_idr"] == 75000
    assert body["is_active"] is True
    assert count_services(db) == 1


def test_create_defaults_description_and_price(api, db):
    add_user(db, "admin@example.com", role="admin")
    csrf = login(api, "admin@example.com")
    r = send(api, "POST", URL, csrf, NEW)
    assert r.status_code == 201
    assert r.json()["description"] == ""
    assert r.json()["price_idr"] == 0


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 121},
        {"name": "x" * 201},
        {"name": None},
        {"duration_minutes": 0},
        {"duration_minutes": 45},
        {"duration_minutes": 510},
        {"duration_minutes": "30"},
        {"price_idr": -1},
        {"price_idr": 2147483648},
        {"price_idr": True},
        {"description": "x" * 2001},
        {"is_active": False},
    ],
    ids=[
        "empty-name",
        "blank-name",
        "name-121",
        "name-201",
        "null-name",
        "zero-duration",
        "off-grid-duration",
        "too-long-duration",
        "string-duration",
        "negative-price",
        "price-over-int-max",
        "bool-price",
        "long-description",
        "is-active-extra-field",
    ],
)
def test_create_invalid_body_is_422(api, db, overrides):
    add_user(db, "admin@example.com", role="admin")
    csrf = login(api, "admin@example.com")
    r = send(api, "POST", URL, csrf, {**NEW, **overrides})
    assert r.status_code == 422
    assert count_services(db) == 0


@pytest.mark.parametrize("missing", ["name", "duration_minutes"])
def test_create_missing_required_field_is_422(api, db, missing):
    add_user(db, "admin@example.com", role="admin")
    csrf = login(api, "admin@example.com")
    body = {k: v for k, v in NEW.items() if k != missing}
    assert send(api, "POST", URL, csrf, body).status_code == 422
    assert count_services(db) == 0


def test_create_duplicate_name_is_409_ignoring_case(api, db):
    add_user(db, "admin@example.com", role="admin")
    add_service(db, "Haircut")
    csrf = login(api, "admin@example.com")
    r = send(api, "POST", URL, csrf, {**NEW, "name": "haircut"})
    assert r.status_code == 409
    assert count_services(db) == 1


# ---------- list ----------


def test_list_includes_inactive_and_can_filter(api, db):
    add_user(db, "admin@example.com", role="admin")
    add_service(db, "beta")
    add_service(db, "Alpha")
    add_service(db, "gamma", active=False)
    login(api, "admin@example.com")

    r = api.get(URL)
    assert r.status_code == 200
    assert [s["name"] for s in r.json()] == ["Alpha", "beta", "gamma"]
    assert [s["is_active"] for s in r.json()] == [True, True, False]

    r = api.get(URL, params={"active": "true"})
    assert [s["name"] for s in r.json()] == ["Alpha", "beta"]
    r = api.get(URL, params={"active": "false"})
    assert [s["name"] for s in r.json()] == ["gamma"]


def test_list_bad_active_value_is_422(api, db):
    add_user(db, "admin@example.com", role="admin")
    login(api, "admin@example.com")
    assert api.get(URL, params={"active": "maybe"}).status_code == 422


# ---------- patch ----------


def test_patch_changes_only_the_given_fields(api, db):
    add_user(db, "admin@example.com", role="admin")
    service = add_service(db, "Haircut", price_idr=50000, description="Old")
    csrf = login(api, "admin@example.com")
    r = send(api, "PATCH", f"{URL}/{service.id}", csrf, {"price_idr": 60000})
    assert r.status_code == 200
    body = r.json()
    assert body["price_idr"] == 60000
    assert body["name"] == "Haircut"
    assert body["description"] == "Old"
    assert body["duration_minutes"] == 30
    assert body["is_active"] is True


def test_patch_with_empty_body_is_a_no_op(api, db):
    add_user(db, "admin@example.com", role="admin")
    service = add_service(db)
    csrf = login(api, "admin@example.com")
    r = send(api, "PATCH", f"{URL}/{service.id}", csrf, {})
    assert r.status_code == 200
    assert r.json()["name"] == "Haircut"


def test_patch_cannot_set_is_active(api, db):
    add_user(db, "admin@example.com", role="admin")
    service = add_service(db)
    csrf = login(api, "admin@example.com")
    r = send(api, "PATCH", f"{URL}/{service.id}", csrf, {"is_active": False})
    assert r.status_code == 422
    db.refresh(service)
    assert service.is_active is True


@pytest.mark.parametrize("field", ["name", "description", "duration_minutes", "price_idr"])
def test_patch_explicit_null_is_422(api, db, field):
    add_user(db, "admin@example.com", role="admin")
    service = add_service(db)
    csrf = login(api, "admin@example.com")
    assert send(api, "PATCH", f"{URL}/{service.id}", csrf, {field: None}).status_code == 422
    db.refresh(service)
    assert service.name == "Haircut"
    assert service.description == "Old"
    assert service.duration_minutes == 30
    assert service.price_idr == 50000


@pytest.mark.parametrize(
    "changes",
    [{"duration_minutes": 45}, {"price_idr": -1}, {"name": ""}],
    ids=["off-grid-duration", "negative-price", "empty-name"],
)
def test_patch_invalid_value_is_422(api, db, changes):
    add_user(db, "admin@example.com", role="admin")
    service = add_service(db)
    csrf = login(api, "admin@example.com")
    assert send(api, "PATCH", f"{URL}/{service.id}", csrf, changes).status_code == 422
    db.refresh(service)
    assert service.name == "Haircut"
    assert service.duration_minutes == 30
    assert service.price_idr == 50000


def test_patch_to_another_services_name_is_409(api, db):
    add_user(db, "admin@example.com", role="admin")
    add_service(db, "Haircut")
    other = add_service(db, "Shave")
    csrf = login(api, "admin@example.com")
    r = send(api, "PATCH", f"{URL}/{other.id}", csrf, {"name": "HAIRCUT"})
    assert r.status_code == 409
    db.refresh(other)
    assert other.name == "Shave"


def test_patch_to_own_name_in_another_case_is_200(api, db):
    add_user(db, "admin@example.com", role="admin")
    service = add_service(db, "haircut")
    csrf = login(api, "admin@example.com")
    r = send(api, "PATCH", f"{URL}/{service.id}", csrf, {"name": "Haircut"})
    assert r.status_code == 200
    assert r.json()["name"] == "Haircut"


def test_patch_unknown_id_is_404(api, db):
    add_user(db, "admin@example.com", role="admin")
    csrf = login(api, "admin@example.com")
    assert send(api, "PATCH", f"{URL}/{uuid.uuid4()}", csrf, {"price_idr": 1}).status_code == 404


def test_patch_bad_uuid_is_422(api, db):
    add_user(db, "admin@example.com", role="admin")
    csrf = login(api, "admin@example.com")
    assert send(api, "PATCH", f"{URL}/not-a-uuid", csrf, {"price_idr": 1}).status_code == 422


# ---------- activate / deactivate ----------


def test_deactivate_hides_service_and_activate_restores_it(api, db):
    add_user(db, "admin@example.com", role="admin")
    service = add_service(db)
    csrf = login(api, "admin@example.com")
    slots_url = f"/services/{service.id}/slots"
    params = {"date": "2026-11-03"}

    assert [s["id"] for s in api.get("/services").json()] == [str(service.id)]

    r = send(api, "POST", f"{URL}/{service.id}/deactivate", csrf)
    assert r.status_code == 200
    assert r.json()["is_active"] is False
    assert api.get("/services").json() == []
    assert api.get(slots_url, params=params).status_code == 404

    r = send(api, "POST", f"{URL}/{service.id}/activate", csrf)
    assert r.status_code == 200
    assert r.json()["is_active"] is True
    assert [s["id"] for s in api.get("/services").json()] == [str(service.id)]
    assert api.get(slots_url, params=params).status_code == 200


def test_deactivating_twice_is_200(api, db):
    add_user(db, "admin@example.com", role="admin")
    service = add_service(db)
    csrf = login(api, "admin@example.com")
    assert send(api, "POST", f"{URL}/{service.id}/deactivate", csrf).status_code == 200
    r = send(api, "POST", f"{URL}/{service.id}/deactivate", csrf)
    assert r.status_code == 200
    assert r.json()["is_active"] is False


@pytest.mark.parametrize("action", ["deactivate", "activate"])
def test_unknown_id_is_404(api, db, action):
    add_user(db, "admin@example.com", role="admin")
    csrf = login(api, "admin@example.com")
    assert send(api, "POST", f"{URL}/{uuid.uuid4()}/{action}", csrf).status_code == 404


def test_existing_appointment_survives_deactivation_and_can_still_be_cancelled(api, db):
    owner = add_user(db, "a@example.com")
    add_user(db, "admin@example.com", role="admin")
    service = add_service(db)
    appt = add_appt(db, owner, service, APPT_START)
    csrf = login(api, "admin@example.com")

    r = send(api, "POST", f"{URL}/{service.id}/deactivate", csrf)
    assert r.status_code == 200

    cancelled = cancel_appointment(db, user=owner, appointment_id=appt.id, now=NOW)
    assert cancelled.status == "cancelled"
    assert cancelled.cancelled_by_id == owner.id
    