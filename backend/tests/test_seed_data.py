from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models import Appointment, BusinessHour, Service, UnavailablePeriod, User
from scripts.seed import CUSTOMERS, FUTURE_DAYS, JAKARTA, PAST_DAYS, RECENT_UNMARKED, seed

NOW = datetime(2026, 11, 4, 6, 15, tzinfo=UTC)  # Wednesday 13:15 in Jakarta
DEMO = "demo.customer@example.com"


def run_seed(db, now=NOW):
    seed(db, passwords={}, now=now, demo_mode=False)
    db.commit()


def count(db, model, *where):
    return db.scalar(select(func.count()).select_from(model).where(*where))


def appointments(db):
    return list(db.scalars(select(Appointment).order_by(Appointment.starts_at)))


def active(rows):
    return [a for a in rows if a.status != "cancelled"]


def test_seeds_services_customers_and_closures(db):
    run_seed(db)
    assert count(db, Service, Service.is_active.is_(True)) == 8
    assert count(db, Service, Service.is_active.is_(False)) == 1
    assert count(db, User, User.role == "customer") == len(CUSTOMERS) + 1
    assert count(db, UnavailablePeriod) == 3
    emails = db.scalars(select(User.email).where(User.role == "customer")).all()
    assert all(email.endswith("@example.com") for email in emails)


def test_prices_are_realistic_idr(db):
    run_seed(db)
    prices = db.scalars(select(Service.price_idr)).all()
    assert all(40_000 <= price <= 500_000 and price % 5_000 == 0 for price in prices)


def test_appointments_span_three_weeks_back_and_two_ahead(db):
    run_seed(db)
    rows = appointments(db)
    assert len(rows) > 100
    assert rows[0].starts_at < NOW - timedelta(days=PAST_DAYS - 3)
    assert rows[-1].starts_at > NOW + timedelta(days=FUTURE_DAYS - 3)
    assert rows[0].starts_at >= NOW - timedelta(days=PAST_DAYS + 1)
    assert rows[-1].starts_at <= NOW + timedelta(days=FUTURE_DAYS + 1)


@pytest.mark.parametrize("now", [NOW, NOW + timedelta(days=45, hours=7)])
def test_dates_follow_now(db, now):
    run_seed(db, now)
    rows = appointments(db)
    assert any(a.starts_at < now - timedelta(days=14) for a in rows)
    assert any(a.starts_at > now + timedelta(days=7) for a in rows)


def test_statuses_fit_the_timeline(db):
    run_seed(db)
    rows = appointments(db)
    past = [a for a in rows if a.starts_at <= NOW]
    future = [a for a in rows if a.starts_at > NOW]
    assert {a.status for a in future} <= {"booked", "cancelled"}
    assert {"completed", "no_show", "cancelled"} <= {a.status for a in past}
    # Only the newest started ones wait for staff to mark them.
    unmarked = [a for a in past if a.status == "booked"]
    assert len(unmarked) == RECENT_UNMARKED
    assert unmarked == active(past)[-RECENT_UNMARKED:]
    for a in rows:
        if a.status == "cancelled":
            assert a.cancelled_at is not None and a.cancelled_at <= NOW
            assert a.cancelled_by_id is not None


def test_active_appointments_never_overlap(db):
    run_seed(db)
    rows = active(appointments(db))
    for earlier, later in zip(rows, rows[1:]):
        assert earlier.ends_at <= later.starts_at


def test_appointments_fit_business_hours(db):
    run_seed(db)
    hours = {}
    for h in db.scalars(select(BusinessHour)):
        hours.setdefault(h.weekday, []).append((h.open_minute, h.close_minute))
    for a in appointments(db):
        local = a.starts_at.astimezone(JAKARTA)
        start = local.hour * 60 + local.minute
        end = start + int((a.ends_at - a.starts_at).total_seconds() // 60)
        assert any(o <= start and end <= c for o, c in hours.get(local.weekday(), [])), local
        assert local.minute in (0, 30) and local.second == 0


def test_no_appointment_falls_inside_a_closure(db):
    run_seed(db)
    closures = db.scalars(select(UnavailablePeriod)).all()
    for a in appointments(db):
        for c in closures:
            assert not (a.starts_at < c.ends_at and c.starts_at < a.ends_at)


def test_only_active_services_are_booked(db):
    run_seed(db)
    inactive = db.scalar(select(Service.id).where(Service.is_active.is_(False)))
    assert count(db, Appointment, Appointment.service_id == inactive) == 0


def test_demo_customer_has_history_and_a_changeable_booking(db):
    run_seed(db)
    demo_id = db.scalar(select(User.id).where(User.email == DEMO))
    mine = [a for a in appointments(db) if a.customer_id == demo_id]
    assert sum(a.status == "completed" for a in mine) >= 3
    assert any(a.status == "cancelled" for a in mine)
    assert any(a.status == "booked" and a.starts_at - NOW >= timedelta(hours=48) for a in mine)


def test_rerun_is_idempotent(db):
    run_seed(db)
    before = (count(db, User), count(db, Service), count(db, Appointment),
              count(db, UnavailablePeriod), count(db, BusinessHour))
    run_seed(db, NOW + timedelta(days=3))
    after = (count(db, User), count(db, Service), count(db, Appointment),
             count(db, UnavailablePeriod), count(db, BusinessHour))
    assert after == before


def test_same_now_gives_the_same_data(db):
    run_seed(db)
    first = [(a.starts_at, a.status) for a in appointments(db)]
    db.execute(Appointment.__table__.delete())
    db.commit()
    run_seed(db)
    assert [(a.starts_at, a.status) for a in appointments(db)] == first
