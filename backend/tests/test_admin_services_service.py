import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select

import app.admin_services as admin_services
from app.admin_services import (
    MAX_PRICE_IDR,
    InvalidService,
    ServiceNameTaken,
    UnknownService,
    create_service,
    list_services,
    set_active,
    update_service,
)
from app.availability import ServiceNotFound, get_free_slots
from app.booking import BookingForbidden
from app.models import Appointment, Service, User
from app.security.passwords import hash_password

PW = "correct horse battery staple"
DAY = date(2026, 11, 3)


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


def make(db, admin: User, **overrides) -> Service:
    args = {"name": "Haircut", "duration_minutes": 30}
    args.update(overrides)
    return create_service(db, user=admin, **args)


def count(db) -> int:
    return db.scalar(select(func.count()).select_from(Service))


# ---------- create ----------


def test_admin_creates_service(db, admin):
    service = create_service(
        db,
        user=admin,
        name="Haircut",
        description="Cut and style",
        duration_minutes=60,
        price_idr=75000,
    )
    assert service.id is not None
    assert service.name == "Haircut"
    assert service.description == "Cut and style"
    assert service.duration_minutes == 60
    assert service.price_idr == 75000
    assert service.is_active is True
    assert db.get(Service, service.id) is service


def test_create_strips_name_and_description(db, admin):
    service = make(db, admin, name="  Haircut  ", description="  Nice  ")
    assert service.name == "Haircut"
    assert service.description == "Nice"


def test_create_defaults_description_and_price(db, admin):
    service = make(db, admin)
    assert service.description == ""
    assert service.price_idr == 0


@pytest.mark.parametrize("role", ["customer", "staff"])
def test_non_admin_cannot_create(db, role):
    actor = add_user(db, "actor@example.com", role=role)
    with pytest.raises(BookingForbidden):
        create_service(db, user=actor, name="Haircut", duration_minutes=30)
    assert count(db) == 0


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 121},
        {"duration_minutes": 0},
        {"duration_minutes": 45},
        {"duration_minutes": 510},
        {"price_idr": -1},
        {"price_idr": MAX_PRICE_IDR + 1},
        {"price_idr": True},
        {"description": "x" * 2001},
    ],
    ids=[
        "empty-name",
        "blank-name",
        "long-name",
        "zero-duration",
        "off-grid-duration",
        "too-long-duration",
        "negative-price",
        "price-over-int-max",
        "bool-price",
        "long-description",
    ],
)
def test_invalid_values_are_refused(db, admin, overrides):
    with pytest.raises(InvalidService):
        make(db, admin, **overrides)
    assert count(db) == 0


@pytest.mark.parametrize("minutes", [30, 480])
def test_duration_limits_are_accepted(db, admin, minutes):
    assert make(db, admin, duration_minutes=minutes).duration_minutes == minutes


def test_max_price_is_accepted(db, admin):
    assert make(db, admin, price_idr=MAX_PRICE_IDR).price_idr == MAX_PRICE_IDR


def test_duplicate_name_is_refused_ignoring_case_and_spaces(db, admin):
    make(db, admin, name="Haircut")
    with pytest.raises(ServiceNameTaken):
        make(db, admin, name="  haircut ")
    assert count(db) == 1


def test_database_constraint_catches_a_duplicate_the_check_missed(db, admin, monkeypatch):
    make(db, admin, name="Haircut")
    monkeypatch.setattr(admin_services, "_name_taken", lambda *args, **kwargs: False)
    with pytest.raises(ServiceNameTaken):
        make(db, admin, name="Haircut")
    assert count(db) == 1  # savepoint rolled back; the session is still usable


# ---------- update ----------


def test_update_changes_only_the_given_fields(db, admin):
    service = make(db, admin, name="Haircut", description="Old", price_idr=50000)
    updated = update_service(
        db, user=admin, service_id=service.id, changes={"price_idr": 60000}
    )
    assert updated.price_idr == 60000
    assert updated.name == "Haircut"
    assert updated.description == "Old"
    assert updated.duration_minutes == 30


def test_update_can_change_several_fields(db, admin):
    service = make(db, admin)
    updated = update_service(
        db,
        user=admin,
        service_id=service.id,
        changes={
            "name": " Beard trim ",
            "description": "New",
            "duration_minutes": 60,
            "price_idr": 0,
        },
    )
    assert updated.name == "Beard trim"
    assert updated.description == "New"
    assert updated.duration_minutes == 60
    assert updated.price_idr == 0


def test_renaming_to_own_name_in_another_case_is_allowed(db, admin):
    service = make(db, admin, name="haircut")
    updated = update_service(
        db, user=admin, service_id=service.id, changes={"name": "Haircut"}
    )
    assert updated.name == "Haircut"


def test_renaming_to_another_services_name_is_refused(db, admin):
    make(db, admin, name="Haircut")
    other = make(db, admin, name="Shave")
    with pytest.raises(ServiceNameTaken):
        update_service(db, user=admin, service_id=other.id, changes={"name": "HAIRCUT"})
    assert other.name == "Shave"


def test_update_with_invalid_value_is_refused(db, admin):
    service = make(db, admin)
    with pytest.raises(InvalidService):
        update_service(
            db, user=admin, service_id=service.id, changes={"duration_minutes": 45}
        )
    assert service.duration_minutes == 30


def test_update_cannot_touch_is_active(db, admin):
    service = make(db, admin)
    with pytest.raises(ValueError, match="unknown fields"):
        update_service(db, user=admin, service_id=service.id, changes={"is_active": False})
    assert service.is_active is True


def test_update_with_no_changes_is_a_no_op(db, admin):
    service = make(db, admin)
    assert update_service(db, user=admin, service_id=service.id, changes={}) is service


def test_update_unknown_id_is_not_found(db, admin):
    with pytest.raises(UnknownService):
        update_service(db, user=admin, service_id=uuid.uuid4(), changes={"price_idr": 1})


@pytest.mark.parametrize("role", ["customer", "staff"])
def test_non_admin_cannot_update_or_deactivate(db, admin, role):
    service = make(db, admin)
    actor = add_user(db, "actor@example.com", role=role)
    with pytest.raises(BookingForbidden):
        update_service(db, user=actor, service_id=service.id, changes={"price_idr": 1})
    with pytest.raises(BookingForbidden):
        set_active(db, user=actor, service_id=service.id, active=False)
    assert service.is_active is True
    assert service.price_idr == 0


# ---------- activate / deactivate ----------


def test_deactivate_stops_booking_and_reactivate_restores_it(db, admin):
    service = make(db, admin)
    assert set_active(db, user=admin, service_id=service.id, active=False).is_active is False
    with pytest.raises(ServiceNotFound):
        get_free_slots(db, service.id, DAY)
    assert set_active(db, user=admin, service_id=service.id, active=True).is_active is True
    get_free_slots(db, service.id, DAY)  # must no longer raise ServiceNotFound


def test_set_active_is_idempotent(db, admin):
    service = make(db, admin)
    assert set_active(db, user=admin, service_id=service.id, active=False).is_active is False
    assert set_active(db, user=admin, service_id=service.id, active=False).is_active is False


def test_deactivating_keeps_existing_appointments(db, admin):
    service = make(db, admin)
    customer = add_user(db, "a@example.com")
    start = datetime(2026, 11, 3, 2, 0, tzinfo=UTC)
    appt = Appointment(
        customer_id=customer.id,
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(minutes=30),
        status="booked",
        created_by_id=customer.id,
    )
    db.add(appt)
    db.commit()
    set_active(db, user=admin, service_id=service.id, active=False)
    db.refresh(appt)
    assert appt.status == "booked"
    assert appt.service_id == service.id


def test_set_active_unknown_id_is_not_found(db, admin):
    with pytest.raises(UnknownService):
        set_active(db, user=admin, service_id=uuid.uuid4(), active=False)


# ---------- list ----------


def test_list_is_ordered_by_name_and_can_filter_by_active(db, admin):
    make(db, admin, name="beta")
    make(db, admin, name="Alpha")
    gamma = make(db, admin, name="gamma")
    set_active(db, user=admin, service_id=gamma.id, active=False)

    def names(items):
        return [s.name for s in items]

    assert names(list_services(db)) == ["Alpha", "beta", "gamma"]
    assert names(list_services(db, active=True)) == ["Alpha", "beta"]
    assert names(list_services(db, active=False)) == ["gamma"]
    