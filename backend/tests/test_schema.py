import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.models import Appointment, BusinessHour, Service, UnavailablePeriod, User

T0 = datetime(2030, 1, 7, 2, 0, tzinfo=timezone.utc)  # Mon 09:00 Asia/Jakarta


def assert_rejected(db, obj, constraint: str):
    db.add(obj)
    with pytest.raises(IntegrityError) as exc:
        db.flush()
    db.rollback()
    assert constraint in str(exc.value)


def make_user(db, email="ha@example.com", role="customer"):
    user = User(email=email, password_hash="x" * 20, full_name="Test User", role=role)
    db.add(user)
    db.commit()
    return user


def make_service(db, name="Haircut", minutes=60):
    svc = Service(name=name, duration_minutes=minutes, price_idr=100000)
    db.add(svc)
    db.commit()
    return svc


def appt(user, svc, start, minutes=60, **kw):
    return Appointment(
        customer_id=user.id, service_id=svc.id, created_by_id=user.id,
        starts_at=start, ends_at=start + timedelta(minutes=minutes), **kw,
    )


def test_migration_created_all_tables(engine):
    names = set(inspect(engine).get_table_names())
    assert {"users", "services", "business_hours", "unavailable_periods",
            "appointments", "alembic_version"} <= names


def test_user_email_unique_and_lowercase(db):
    make_user(db)
    assert_rejected(db, User(email="ha@example.com", password_hash="x" * 20, full_name="B"),
                    "uq_users_email")
    assert_rejected(db, User(email="Mixed@Example.com", password_hash="x" * 20, full_name="B"),
                    "ck_users_email_lowercase")


def test_user_role_must_be_valid(db):
    assert_rejected(db, User(email="a@example.com", password_hash="x" * 20,
                             full_name="A", role="root"), "ck_users_role_valid")


@pytest.mark.parametrize("minutes", [0, 45, -30, 510])
def test_service_duration_must_be_valid(db, minutes):
    assert_rejected(db, Service(name="Bad", duration_minutes=minutes),
                    "ck_services_duration_valid")


def test_business_hours_overlap_rejected_adjacent_allowed(db):
    db.add(BusinessHour(weekday=0, open_minute=540, close_minute=720))
    db.commit()
    assert_rejected(db, BusinessHour(weekday=0, open_minute=600, close_minute=780),
                    "ex_business_hours_no_overlap")
    db.add_all([BusinessHour(weekday=0, open_minute=720, close_minute=1020),   # adjacent: ok
                BusinessHour(weekday=1, open_minute=540, close_minute=720)])   # other day: ok
    db.commit()


def test_unavailable_period_must_end_after_start(db):
    user = make_user(db)
    assert_rejected(db, UnavailablePeriod(starts_at=T0, ends_at=T0, created_by_id=user.id),
                    "ck_unavailable_periods_ends_after_starts")


def test_overlapping_appointments_rejected_adjacent_allowed(db):
    user, svc = make_user(db), make_service(db)
    db.add(appt(user, svc, T0))
    db.commit()
    assert_rejected(db, appt(user, svc, T0 + timedelta(minutes=30)), "ex_appointments_no_overlap")
    db.add(appt(user, svc, T0 + timedelta(minutes=60)))  # back-to-back is fine
    db.commit()


def test_cancelled_appointment_frees_the_slot(db):
    user, svc = make_user(db), make_service(db)
    first = appt(user, svc, T0)
    db.add(first)
    db.commit()
    first.status, first.cancelled_at, first.cancelled_by_id = "cancelled", T0, user.id
    db.commit()
    db.add(appt(user, svc, T0))
    db.commit()


def test_cancelled_status_requires_cancelled_at(db):
    user, svc = make_user(db), make_service(db)
    assert_rejected(db, appt(user, svc, T0, status="cancelled"),
                    "ck_appointments_cancelled_at_matches_status")


def test_appointment_must_end_after_start(db):
    user, svc = make_user(db), make_service(db)
    assert_rejected(db, appt(user, svc, T0, minutes=0), "ck_appointments_ends_after_starts")


@pytest.mark.parametrize("offset_minutes", [15, 1])
def test_appointment_must_be_slot_aligned(db, offset_minutes):
    user, svc = make_user(db), make_service(db)
    assert_rejected(db, appt(user, svc, T0 + timedelta(minutes=offset_minutes)),
                    "ck_appointments_slot_aligned")


def test_appointment_requires_existing_customer(db):
    svc = make_service(db)
    user = User(id=uuid.uuid4())  # never inserted
    assert_rejected(db, appt(user, svc, T0), "fk_appointments_customer_id_users")


def test_user_with_appointments_cannot_be_deleted(db):
    user, svc = make_user(db), make_service(db)
    db.add(appt(user, svc, T0))
    db.commit()
    db.delete(user)
    with pytest.raises(IntegrityError) as exc:
        db.flush()
    db.rollback()
    assert "fk_appointments_customer_id_users" in str(exc.value)
    