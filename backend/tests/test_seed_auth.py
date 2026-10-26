def test_seed_creates_business_hours_on_empty_db(db):
    from sqlalchemy import func

    from app.models import BusinessHour

    seed(db, passwords={})
    db.commit()
    assert db.scalar(select(func.count()).select_from(BusinessHour)) == 11

from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.deps import get_now
from app.main import app
from app.models import User
from scripts.seed import DEMO_CUSTOMER_PASSWORD, UNUSABLE_PASSWORD, seed

NOW = datetime(2026, 11, 2, 3, 0, tzinfo=UTC)
CUSTOMER = "demo.customer@example.com"
STAFF = "staff@barbershop.example"


@pytest.fixture()
def api(client):
    app.dependency_overrides[get_now] = lambda: NOW
    yield client
    app.dependency_overrides.pop(get_now, None)


def login(api, email, password):
    return api.post("/auth/login", json={"email": email, "password": password})


def user_hash(db, email):
    db.expire_all()
    return db.scalar(select(User.password_hash).where(User.email == email))


def test_demo_customer_can_log_in_after_seed(api, db):
    seed(db, passwords={"customer": DEMO_CUSTOMER_PASSWORD})
    db.commit()
    assert login(api, CUSTOMER, DEMO_CUSTOMER_PASSWORD).status_code == 200


def test_staff_and_admin_keep_unusable_marker_without_passwords(api, db):
    seed(db, passwords={"customer": DEMO_CUSTOMER_PASSWORD})
    db.commit()
    assert user_hash(db, STAFF) == UNUSABLE_PASSWORD
    assert user_hash(db, "admin@barbershop.example") == UNUSABLE_PASSWORD
    assert login(api, STAFF, "anything-at-all").status_code == 401


def test_staff_password_from_env_style_dict_works(api, db):
    seed(db, passwords={"staff": "a-long-staff-password"})
    db.commit()
    assert login(api, STAFF, "a-long-staff-password").status_code == 200


def test_rerun_does_not_change_existing_hash(db):
    pw = {"customer": DEMO_CUSTOMER_PASSWORD}
    seed(db, passwords=pw)
    db.commit()
    first = user_hash(db, CUSTOMER)
    seed(db, passwords=pw)
    db.commit()
    assert user_hash(db, CUSTOMER) == first


def test_rerun_with_new_password_replaces_hash(api, db):
    seed(db, passwords={"customer": "first-password-1"})
    db.commit()
    seed(db, passwords={"customer": "second-password-2"})
    db.commit()
    assert login(api, CUSTOMER, "first-password-1").status_code == 401
    assert login(api, CUSTOMER, "second-password-2").status_code == 200
    