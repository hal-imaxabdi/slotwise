from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.models import Appointment, BusinessHour, Service, UnavailablePeriod, User
from app.routers.catalog import get_now

JAKARTA = ZoneInfo("Asia/Jakarta")
NOW = datetime(2026, 11, 1, 0, 0, tzinfo=timezone.utc)  # Sun 07:00 Jakarta
MONDAY = "2026-11-02"


def at(hour: int, minute: int = 0, day: tuple[int, int, int] = (2026, 11, 2)) -> datetime:
    return datetime(*day, hour, minute, tzinfo=JAKARTA)


@pytest.fixture()
def api(client):
    from app.main import app

    app.dependency_overrides[get_now] = lambda: NOW
    return client


@pytest.fixture()
def world(db):
    """Mon 09-12 and 13-17, one 60-minute service, one customer."""
    user = User(email="c@example.com", password_hash="x" * 20, full_name="C", role="customer")
    svc = Service(name="Cut", duration_minutes=60, price_idr=100000)
    db.add_all([user, svc])
    db.add_all([
        BusinessHour(weekday=0, open_minute=540, close_minute=720),
        BusinessHour(weekday=0, open_minute=780, close_minute=1020),
    ])
    db.commit()
    return user, svc


def book(db, user, svc, start, minutes=60, status="booked"):
    extra = {}
    if status == "cancelled":
        extra = {"cancelled_at": NOW, "cancelled_by_id": user.id}
    db.add(Appointment(
        customer_id=user.id, service_id=svc.id, created_by_id=user.id,
        starts_at=start, ends_at=start + timedelta(minutes=minutes),
        status=status, **extra,
    ))
    db.commit()


def local_times(response) -> list[str]:
    return [s["local_time"] for s in response.json()["slots"]]


def slots_url(svc_id, day=MONDAY) -> str:
    return f"/services/{svc_id}/slots?date={day}"


def test_services_lists_active_only_sorted_without_internals(api, db):
    db.add_all([
        Service(name="Zed", duration_minutes=30, price_idr=1),
        Service(name="Alpha", duration_minutes=60, price_idr=2),
        Service(name="Hidden", duration_minutes=30, price_idr=3, is_active=False),
    ])
    db.commit()
    r = api.get("/services")
    assert r.status_code == 200
    assert [s["name"] for s in r.json()] == ["Alpha", "Zed"]
    assert set(r.json()[0]) == {"id", "name", "description", "duration_minutes", "price_idr"}


def test_open_day_returns_expected_slots_and_utc_times(api, world):
    _, svc = world
    r = api.get(slots_url(svc.id))
    assert r.status_code == 200
    body = r.json()
    assert body["timezone"] == "Asia/Jakarta" and body["duration_minutes"] == 60
    assert len(body["slots"]) == 12
    assert body["slots"][0] == {"starts_at": "2026-11-02T02:00:00Z", "local_time": "09:00"}


def test_back_to_back_booking_blocks_only_overlapping_slots(api, db, world):
    user, svc = world
    book(db, user, svc, at(10))
    times = local_times(api.get(slots_url(svc.id)))
    assert "09:00" in times and "11:00" in times
    assert not {"09:30", "10:00", "10:30"} & set(times)


def test_cancelled_booking_frees_slot(api, db, world):
    user, svc = world
    book(db, user, svc, at(10), status="cancelled")
    assert "10:00" in local_times(api.get(slots_url(svc.id)))


@pytest.mark.parametrize("status", ["completed", "no_show"])
def test_completed_and_no_show_still_block(api, db, world, status):
    user, svc = world
    book(db, user, svc, at(10), status=status)
    assert "10:00" not in local_times(api.get(slots_url(svc.id)))


def test_unavailable_period_blocks_slots(api, db, world):
    user, svc = world
    db.add(UnavailablePeriod(starts_at=at(13), ends_at=at(15), reason="Training",
                             created_by_id=user.id))
    db.commit()
    times = local_times(api.get(slots_url(svc.id)))
    assert not {"13:00", "13:30", "14:00", "14:30"} & set(times)
    assert "15:00" in times and "09:00" in times


def test_weekday_without_hours_returns_empty_list(api, world):
    _, svc = world
    r = api.get(slots_url(svc.id, "2026-11-03"))  # Tuesday: no hours seeded
    assert r.status_code == 200 and r.json()["slots"] == []


def test_past_date_returns_empty_list_not_error(api, world):
    _, svc = world
    r = api.get(slots_url(svc.id, "2026-10-26"))  # a Monday before NOW
    assert r.status_code == 200 and r.json()["slots"] == []


def test_unknown_service_is_404(api, world):
    r = api.get(slots_url("3fa85f64-5717-4562-b3fc-2c963f66afa6"))
    assert r.status_code == 404 and r.json() == {"detail": "Service not found"}


def test_inactive_service_is_404_same_as_unknown(api, db, world):
    _, svc = world
    svc.is_active = False
    db.add(svc)
    db.commit()
    r = api.get(slots_url(svc.id))
    assert r.status_code == 404 and r.json() == {"detail": "Service not found"}


def test_90_day_limit_boundary(api, world):
    _, svc = world
    assert api.get(slots_url(svc.id, "2027-01-30")).status_code == 200  # NOW + 90 days
    assert api.get(slots_url(svc.id, "2027-01-31")).status_code == 422


def test_invalid_inputs_are_422(api, world):
    _, svc = world
    assert api.get(f"/services/{svc.id}/slots").status_code == 422             # missing date
    assert api.get(slots_url(svc.id, "not-a-date")).status_code == 422
    assert api.get(slots_url("not-a-uuid")).status_code == 422
    