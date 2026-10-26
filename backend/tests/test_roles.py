from datetime import UTC, datetime

import pytest
from fastapi import APIRouter, Depends

from app.deps import (
    get_now,
    require_admin,
    require_admin_write,
    require_staff,
    require_staff_write,
)
from app.main import app
from app.models import User
from app.security.passwords import hash_password

NOW = datetime(2026, 11, 2, 3, 0, tzinfo=UTC)
PW = "correct horse battery staple"

probe = APIRouter(prefix="/_probe")


@probe.get("/staff", dependencies=[Depends(require_staff)])
def probe_staff():
    return {"ok": True}


@probe.get("/admin", dependencies=[Depends(require_admin)])
def probe_admin():
    return {"ok": True}


@probe.post("/staff", dependencies=[Depends(require_staff_write)])
def probe_staff_write():
    return {"ok": True}


@probe.post("/admin", dependencies=[Depends(require_admin_write)])
def probe_admin_write():
    return {"ok": True}


@pytest.fixture(scope="module", autouse=True)
def mount_probe():
    app.include_router(probe)
    yield
    app.router.routes[:] = [
        r for r in app.router.routes if "/_probe" not in getattr(r, "path", "")
    ]


@pytest.fixture()
def api(client):
    app.dependency_overrides[get_now] = lambda: NOW
    yield client
    app.dependency_overrides.pop(get_now, None)


def login_as(api, db, role):
    email = f"{role}@example.com"
    db.add(User(email=email, password_hash=hash_password(PW), full_name=role, role=role))
    db.commit()
    r = api.post("/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200
    return {"X-CSRF-Token": r.json()["csrf_token"]}


def test_anonymous_gets_401(api):
    assert api.get("/_probe/staff").status_code == 401
    assert api.get("/_probe/admin").status_code == 401


def test_customer_gets_403_everywhere(api, db):
    h = login_as(api, db, "customer")
    assert api.get("/_probe/staff").status_code == 403
    assert api.get("/_probe/admin").status_code == 403
    assert api.post("/_probe/staff", headers=h).status_code == 403
    assert api.post("/_probe/admin", headers=h).status_code == 403


def test_staff_can_reach_staff_but_not_admin(api, db):
    h = login_as(api, db, "staff")
    assert api.get("/_probe/staff").status_code == 200
    assert api.get("/_probe/admin").status_code == 403
    assert api.post("/_probe/staff", headers=h).status_code == 200
    assert api.post("/_probe/admin", headers=h).status_code == 403


def test_admin_can_reach_both(api, db):
    h = login_as(api, db, "admin")
    assert api.get("/_probe/staff").status_code == 200
    assert api.get("/_probe/admin").status_code == 200
    assert api.post("/_probe/admin", headers=h).status_code == 200


def test_write_routes_require_csrf_even_for_admin(api, db):
    login_as(api, db, "admin")
    assert api.post("/_probe/admin").status_code == 403


def test_demotion_takes_effect_immediately(api, db):
    login_as(api, db, "admin")
    assert api.get("/_probe/admin").status_code == 200
    user = db.query(User).filter_by(email="admin@example.com").one()
    user.role = "customer"
    db.commit()
    assert api.get("/_probe/admin").status_code == 403
    