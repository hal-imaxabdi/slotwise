import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.availability import get_free_slots
from app.booking import BookingForbidden
from app.models import Appointment, BusinessHour, Service, UnavailablePeriod, User
from app.unavailable import (
    InvalidPeriod,
    PeriodConflictsWithAppointments,
    PeriodNotFound,
    create_period,
    delete_period,
    list_periods,
)

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=timezone.utc)
START = datetime(2026, 11, 2, 2, 30, tzinfo=timezone.utc)  # Mon 09:30 Jakarta
END = START + timedelta(hours=1)
MONDAY = date(2026, 11, 2)


def _user(db, email: str, role: str = "staff") -> User:
    user = User(
        email=email,
        password_hash="!unusable",
        full_name=email.split("@")[0],
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _service(db) -> Service:
    service = Service(
        name="Haircut",
        description="test service",
        duration_minutes=30,
        price_idr=50000,
        is_active=True,
    )
    db.add(service)
    db.add(BusinessHour(weekday=0, open_minute=540, close_minute=720))
    db.flush()
    return service


def _appt(db, owner: User, service: Service, start: datetime, status: str = "booked") -> Appointment:
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


def _add_period(db, staff: User, start: datetime) -> UnavailablePeriod:
    period = UnavailablePeriod(
        starts_at=start,
        ends_at=start + timedelta(minutes=30),
        reason="",
        created_by_id=staff.id,
    )
    db.add(period)
    db.commit()
    return period


@pytest.mark.parametrize("role", ["staff", "admin"])
def test_staff_or_admin_creates_period(db, role):
    actor = _user(db, "actor@example.com", role=role)
    period = create_period(db, user=actor, starts_at=START, ends_at=END, reason="  Holiday  ")
    db.commit()
    assert period.id is not None
    assert period.starts_at == START
    assert period.ends_at == END
    assert period.reason == "Holiday"
    assert period.created_by_id == actor.id


def test_customer_is_forbidden(db):
    customer = _user(db, "c@example.com", role="customer")
    with pytest.raises(BookingForbidden):
        create_period(db, user=customer, starts_at=START, ends_at=END, reason="")
    assert db.query(UnavailablePeriod).count() == 0


def test_end_must_be_after_start(db):
    staff = _user(db, "staff@example.com")
    with pytest.raises(InvalidPeriod):
        create_period(db, user=staff, starts_at=START, ends_at=START, reason="")
    with pytest.raises(InvalidPeriod):
        create_period(db, user=staff, starts_at=END, ends_at=START, reason="")
    assert db.query(UnavailablePeriod).count() == 0


@pytest.mark.parametrize(
    "start_offset,end_offset",
    [(timedelta(minutes=15), timedelta(hours=1)), (timedelta(0), timedelta(minutes=45))],
)
def test_times_must_be_on_the_30_minute_grid(db, start_offset, end_offset):
    staff = _user(db, "staff@example.com")
    with pytest.raises(InvalidPeriod):
        create_period(
            db, user=staff, starts_at=START + start_offset, ends_at=START + end_offset, reason=""
        )
    assert db.query(UnavailablePeriod).count() == 0


def test_non_utc_input_is_normalised_to_utc(db):
    staff = _user(db, "staff@example.com")
    jakarta = timezone(timedelta(hours=7))
    period = create_period(
        db,
        user=staff,
        starts_at=START.astimezone(jakarta),
        ends_at=END.astimezone(jakarta),
        reason="",
    )
    assert period.starts_at == START
    assert period.ends_at == END


def test_conflicting_booked_appointment_is_refused_with_count(db):
    staff = _user(db, "staff@example.com")
    owner = _user(db, "owner@example.com", role="customer")
    service = _service(db)
    _appt(db, owner, service, START)
    _appt(db, owner, service, START + timedelta(minutes=30))
    with pytest.raises(PeriodConflictsWithAppointments) as info:
        create_period(db, user=staff, starts_at=START, ends_at=END, reason="")
    assert info.value.count == 2
    assert db.query(UnavailablePeriod).count() == 0


def test_cancelled_appointment_does_not_conflict(db):
    staff = _user(db, "staff@example.com")
    owner = _user(db, "owner@example.com", role="customer")
    _appt(db, owner, _service(db), START, status="cancelled")
    create_period(db, user=staff, starts_at=START, ends_at=END, reason="")
    assert db.query(UnavailablePeriod).count() == 1


def test_appointment_touching_the_edge_does_not_conflict(db):
    staff = _user(db, "staff@example.com")
    owner = _user(db, "owner@example.com", role="customer")
    _appt(db, owner, _service(db), END)  # starts exactly when the period ends
    create_period(db, user=staff, starts_at=START, ends_at=END, reason="")
    assert db.query(UnavailablePeriod).count() == 1


def test_overlapping_periods_are_allowed(db):
    staff = _user(db, "staff@example.com")
    create_period(db, user=staff, starts_at=START, ends_at=END, reason="a")
    create_period(db, user=staff, starts_at=START, ends_at=END, reason="b")
    assert db.query(UnavailablePeriod).count() == 2


def test_created_period_blocks_free_slots(db):
    staff = _user(db, "staff@example.com")
    service = _service(db)
    db.commit()
    assert START in get_free_slots(db, service.id, MONDAY, now=NOW)
    create_period(db, user=staff, starts_at=START, ends_at=END, reason="")
    db.commit()
    assert START not in get_free_slots(db, service.id, MONDAY, now=NOW)


def test_delete_frees_the_slots_again(db):
    staff = _user(db, "staff@example.com")
    service = _service(db)
    period = create_period(db, user=staff, starts_at=START, ends_at=END, reason="")
    db.commit()
    delete_period(db, user=staff, period_id=period.id)
    db.commit()
    assert db.query(UnavailablePeriod).count() == 0
    assert START in get_free_slots(db, service.id, MONDAY, now=NOW)


def test_delete_unknown_id_is_not_found(db):
    staff = _user(db, "staff@example.com")
    db.commit()
    with pytest.raises(PeriodNotFound):
        delete_period(db, user=staff, period_id=uuid.uuid4())


def test_delete_requires_staff(db):
    staff = _user(db, "staff@example.com")
    customer = _user(db, "c@example.com", role="customer")
    period = create_period(db, user=staff, starts_at=START, ends_at=END, reason="")
    db.commit()
    with pytest.raises(BookingForbidden):
        delete_period(db, user=customer, period_id=period.id)
    assert db.query(UnavailablePeriod).count() == 1


def test_list_is_newest_first_with_paging(db):
    staff = _user(db, "staff@example.com")
    periods = [_add_period(db, staff, START + timedelta(hours=h)) for h in range(3)]
    newest_first = [p.id for p in reversed(periods)]
    page1 = list_periods(db, date_from=None, date_to=None, limit=2, offset=0)
    page2 = list_periods(db, date_from=None, date_to=None, limit=2, offset=2)
    assert [p.id for p in page1] == newest_first[:2]
    assert [p.id for p in page2] == newest_first[2:]


def test_list_date_filter_uses_jakarta_days(db):
    staff = _user(db, "staff@example.com")
    nov2 = _add_period(db, staff, START)  # Nov 2 09:30 Jakarta
    nov3 = _add_period(db, staff, datetime(2026, 11, 2, 17, 30, tzinfo=timezone.utc))  # Nov 3 00:30
    on_2 = list_periods(db, date_from=date(2026, 11, 2), date_to=date(2026, 11, 2), limit=50, offset=0)
    on_3 = list_periods(db, date_from=date(2026, 11, 3), date_to=date(2026, 11, 3), limit=50, offset=0)
    assert [p.id for p in on_2] == [nov2.id]
    assert [p.id for p in on_3] == [nov3.id]
    