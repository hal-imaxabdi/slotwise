from datetime import UTC, datetime, timedelta

import pytest

import app.admin_hours as admin_hours
from app.admin_hours import (
    HoursConflictWithAppointments,
    InvalidHours,
    list_hours,
    replace_day,
)
from app.availability import BUSINESS_TZ
from app.booking import BookingForbidden
from app.models import Appointment, BusinessHour, Service, User
from app.security.passwords import hash_password

PW = "correct horse battery staple"
NOW = datetime(2026, 11, 2, 10, 0, tzinfo=UTC)  # Monday 17:00 Jakarta
MON, TUE = 2, 3  # November 2026 day numbers; weekdays 0 and 1


def jakarta(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 11, day, hour, minute, tzinfo=BUSINESS_TZ).astimezone(UTC)


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


@pytest.fixture()
def admin(db) -> User:
    return add_user(db, "admin@example.com", role="admin")


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


def add_appt(
    db, owner: User, service: Service, start: datetime, minutes: int = 30, status: str = "booked"
) -> Appointment:
    appt = Appointment(
        customer_id=owner.id,
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(minutes=minutes),
        status=status,
        created_by_id=owner.id,
    )
    if status == "cancelled":
        appt.cancelled_at = NOW
        appt.cancelled_by_id = owner.id
    db.add(appt)
    db.commit()
    return appt


def put(db, user: User, weekday: int, intervals):
    return replace_day(db, user=user, weekday=weekday, intervals=intervals, now=NOW)


def stored(db, weekday: int) -> list[tuple[int, int]]:
    return [(h.open_minute, h.close_minute) for h in list_hours(db) if h.weekday == weekday]


# ---------- replacing a day ----------


def test_admin_sets_a_days_hours(db, admin):
    result = put(db, admin, 1, [(540, 720), (780, 1020)])
    assert [(h.open_minute, h.close_minute) for h in result] == [(540, 720), (780, 1020)]
    assert all(h.weekday == 1 for h in result)
    assert stored(db, 1) == [(540, 720), (780, 1020)]


def test_input_order_does_not_matter(db, admin):
    put(db, admin, 1, [(780, 1020), (540, 720)])
    assert stored(db, 1) == [(540, 720), (780, 1020)]


def test_replaces_only_that_day(db, admin):
    add_hour(db, 1, 540, 720)
    add_hour(db, 1, 780, 1020)
    add_hour(db, 2, 540, 720)
    put(db, admin, 1, [(600, 900)])
    assert stored(db, 1) == [(600, 900)]
    assert stored(db, 2) == [(540, 720)]


def test_touching_intervals_are_allowed(db, admin):
    put(db, admin, 1, [(540, 720), (720, 900)])
    assert stored(db, 1) == [(540, 720), (720, 900)]


def test_eight_intervals_are_allowed(db, admin):
    intervals = [(i * 60, i * 60 + 30) for i in range(8)]
    put(db, admin, 1, intervals)
    assert stored(db, 1) == intervals


def test_empty_list_closes_the_day(db, admin):
    add_hour(db, 1, 540, 720)
    assert put(db, admin, 1, []) == []
    assert stored(db, 1) == []


def test_same_hours_are_a_no_op(db, admin):
    add_hour(db, 1, 540, 720)
    add_hour(db, 1, 780, 1020)
    before = [h.id for h in list_hours(db)]
    put(db, admin, 1, [(540, 720), (780, 1020)])
    assert [h.id for h in list_hours(db)] == before


@pytest.mark.parametrize("role", ["customer", "staff"])
def test_non_admin_is_forbidden(db, role):
    actor = add_user(db, "actor@example.com", role=role)
    add_hour(db, 1, 540, 720)
    with pytest.raises(BookingForbidden):
        put(db, actor, 1, [(600, 900)])
    assert stored(db, 1) == [(540, 720)]


# ---------- validation ----------


@pytest.mark.parametrize(
    "intervals",
    [
        [(600, 600)],
        [(720, 540)],
        [(545, 720)],
        [(540, 725)],
        [(-30, 60)],
        [(1380, 1470)],
        [(540, 720), (700, 900)],
        [(540, 720), (540, 720)],
        [(False, 720)],
        [(i * 60, i * 60 + 30) for i in range(9)],
    ],
    ids=[
        "zero-length",
        "reversed",
        "off-grid-open",
        "off-grid-close",
        "negative-open",
        "past-midnight",
        "overlap",
        "duplicate",
        "bool-minute",
        "nine-intervals",
    ],
)
def test_invalid_intervals_are_refused_and_nothing_changes(db, admin, intervals):
    add_hour(db, 1, 540, 720)
    with pytest.raises(InvalidHours):
        put(db, admin, 1, intervals)
    assert stored(db, 1) == [(540, 720)]


@pytest.mark.parametrize("weekday", [7, -1, "1", True], ids=["seven", "negative", "string", "bool"])
def test_invalid_weekday_is_refused(db, admin, weekday):
    with pytest.raises(InvalidHours):
        put(db, admin, weekday, [(540, 720)])
    assert list_hours(db) == []


# ---------- conflicts with appointments ----------


def test_conflicting_future_appointment_is_refused_with_count(db, admin):
    owner = add_user(db, "a@example.com")
    add_hour(db, 1, 540, 720)
    add_appt(db, owner, add_service(db), jakarta(TUE, 9))
    with pytest.raises(HoursConflictWithAppointments) as info:
        put(db, admin, 1, [(600, 1020)])
    assert info.value.count == 1
    assert stored(db, 1) == [(540, 720)]


def test_appointment_that_still_fits_is_allowed(db, admin):
    owner = add_user(db, "a@example.com")
    add_appt(db, owner, add_service(db), jakarta(TUE, 9))
    put(db, admin, 1, [(540, 720)])
    assert stored(db, 1) == [(540, 720)]


def test_appointment_ending_exactly_at_close_fits(db, admin):
    owner = add_user(db, "a@example.com")
    add_appt(db, owner, add_service(db), jakarta(TUE, 11, 30))
    put(db, admin, 1, [(540, 720)])
    assert stored(db, 1) == [(540, 720)]


def test_appointment_spanning_two_touching_intervals_is_a_conflict(db, admin):
    owner = add_user(db, "a@example.com")
    add_appt(db, owner, add_service(db), jakarta(TUE, 11, 30), minutes=60)
    with pytest.raises(HoursConflictWithAppointments) as info:
        put(db, admin, 1, [(540, 720), (720, 900)])
    assert info.value.count == 1
    assert stored(db, 1) == []


def test_closing_a_day_with_appointments_is_a_conflict(db, admin):
    owner = add_user(db, "a@example.com")
    add_hour(db, 1, 540, 720)
    add_appt(db, owner, add_service(db), jakarta(TUE, 9))
    with pytest.raises(HoursConflictWithAppointments):
        put(db, admin, 1, [])
    assert stored(db, 1) == [(540, 720)]


def test_cancelled_appointment_is_ignored(db, admin):
    owner = add_user(db, "a@example.com")
    add_appt(db, owner, add_service(db), jakarta(TUE, 9), status="cancelled")
    put(db, admin, 1, [(780, 1020)])
    assert stored(db, 1) == [(780, 1020)]


def test_past_appointment_is_ignored(db, admin):
    owner = add_user(db, "a@example.com")
    add_appt(db, owner, add_service(db), jakarta(MON, 9))  # before NOW
    put(db, admin, 0, [(780, 1020)])
    assert stored(db, 0) == [(780, 1020)]


def test_appointment_on_another_weekday_is_ignored(db, admin):
    owner = add_user(db, "a@example.com")
    add_appt(db, owner, add_service(db), jakarta(TUE, 9))  # Tuesday
    put(db, admin, 2, [(780, 1020)])  # Wednesday
    assert stored(db, 2) == [(780, 1020)]


def test_only_unfitting_appointments_are_counted(db, admin):
    owner = add_user(db, "a@example.com")
    service = add_service(db)
    add_appt(db, owner, service, jakarta(TUE, 9))  # outside 10:00-12:00
    add_appt(db, owner, service, jakarta(TUE, 10))  # inside
    with pytest.raises(HoursConflictWithAppointments) as info:
        put(db, admin, 1, [(600, 720)])
    assert info.value.count == 1


# ---------- database backstop and listing ----------


def test_database_constraint_is_the_backstop(db, admin, monkeypatch):
    add_hour(db, 1, 540, 720)
    before = [h.id for h in list_hours(db)]
    monkeypatch.setattr(
        admin_hours, "_validate_intervals", lambda intervals: [tuple(i) for i in intervals]
    )
    with pytest.raises(InvalidHours):
        put(db, admin, 1, [(540, 720), (690, 900)])  # on the grid, overlapping
    assert [h.id for h in list_hours(db)] == before  # savepoint restored the old row

def test_list_is_ordered_by_weekday_then_opening_time(db):
    add_hour(db, 2, 540, 720)
    add_hour(db, 0, 780, 1020)
    add_hour(db, 0, 540, 720)
    assert [(h.weekday, h.open_minute) for h in list_hours(db)] == [(0, 540), (0, 780), (2, 540)]
    