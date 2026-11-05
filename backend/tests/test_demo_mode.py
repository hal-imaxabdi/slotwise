from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.config import settings
from app.deps import get_now
from app.main import app
from app.models import Appointment, Service, User, UserSession
from app.security.passwords import hash_password
from app.sessions import create_session
from scripts import reset_demo as reset_script
from scripts.reset_demo import DemoModeRequired, reset_demo
from scripts.seed import UNUSABLE_PASSWORD, default_passwords, seed

NOW = datetime(2026, 11, 4, 6, 15, tzinfo=UTC)
STAFF = "staff@barbershop.example"
ADMIN = "admin@barbershop.example"
CUSTOMER = "demo.customer@example.com"
STAFF_PW = "demo-staff-2026"
ADMIN_PW = "demo-admin-2026"
REAL = "real.person@example.com"
REAL_PW = "a-real-long-password"


@pytest.fixture()
def demo_mode(monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", True)


@pytest.fixture()
def clock():
    box = {"now": NOW}
    app.dependency_overrides[get_now] = lambda: box["now"]
    yield box
    app.dependency_overrides.pop(get_now, None)


@pytest.fixture()
def api(client, clock):
    return client


def login(api, email, password):
    return api.post("/auth/login", json={"email": email, "password": password})


def seed_demo(db):
    seed(db, now=NOW, demo_mode=True)
    db.commit()


def add_real_user(db):
    db.add(User(email=REAL, full_name="Real Person", password_hash=hash_password(REAL_PW)))
    db.commit()


def user_hash(db, email):
    db.expire_all()
    return db.scalar(select(User.password_hash).where(User.email == email))


# --- passwords -------------------------------------------------------------------


def test_default_passwords_outside_demo_mode_have_no_staff_or_admin(monkeypatch):
    monkeypatch.delenv("SEED_STAFF_PASSWORD", raising=False)
    monkeypatch.delenv("SEED_ADMIN_PASSWORD", raising=False)
    assert set(default_passwords(demo_mode=False)) == {"customer"}


def test_default_passwords_in_demo_mode_are_the_public_ones(monkeypatch):
    monkeypatch.delenv("SEED_STAFF_PASSWORD", raising=False)
    monkeypatch.delenv("SEED_ADMIN_PASSWORD", raising=False)
    passwords = default_passwords(demo_mode=True)
    assert passwords["staff"] == STAFF_PW and passwords["admin"] == ADMIN_PW


def test_demo_mode_refuses_env_passwords(monkeypatch):
    monkeypatch.setenv("SEED_STAFF_PASSWORD", "a-long-staff-password")
    with pytest.raises(SystemExit, match="DEMO_MODE"):
        default_passwords(demo_mode=True)


def test_demo_seed_lets_all_three_roles_log_in(api, db, demo_mode):
    seed_demo(db)
    for email, password, role in ((CUSTOMER, "demo-customer-2026", "customer"),
                                  (STAFF, STAFF_PW, "staff"), (ADMIN, ADMIN_PW, "admin")):
        r = login(api, email, password)
        assert r.status_code == 200, email
        assert r.json()["user"]["role"] == role


def test_seed_without_demo_mode_revokes_public_demo_passwords(api, db):
    seed_demo(db)
    seed(db, passwords={}, now=NOW, demo_mode=False)
    db.commit()
    assert user_hash(db, STAFF) == UNUSABLE_PASSWORD
    assert user_hash(db, ADMIN) == UNUSABLE_PASSWORD
    assert login(api, STAFF, STAFF_PW).status_code == 401


def test_seed_without_demo_mode_keeps_a_real_staff_password(api, db):
    seed(db, passwords={"staff": "a-long-staff-password"}, now=NOW, demo_mode=False)
    db.commit()
    seed(db, passwords={}, now=NOW, demo_mode=False)
    db.commit()
    assert login(api, STAFF, "a-long-staff-password").status_code == 200


# --- reset -------------------------------------------------------------------------


def test_reset_refuses_without_demo_mode(db):
    seed(db, passwords={}, now=NOW, demo_mode=False)
    db.commit()
    with pytest.raises(DemoModeRequired):
        reset_demo(db, now=NOW)
    db.rollback()
    assert db.scalar(select(func.count()).select_from(Appointment)) > 0


def test_reset_cli_refuses_without_demo_mode(capsys):
    assert reset_script.main([]) == 1
    assert "refusing" in capsys.readouterr().err


def test_reset_cli_if_demo_mode_is_a_quiet_no_op(capsys):
    assert reset_script.main(["--if-demo-mode"]) == 0
    assert "nothing to do" in capsys.readouterr().out


def test_reset_wipes_and_reseeds(db, demo_mode):
    seed_demo(db)
    add_real_user(db)
    real = db.scalar(select(User).where(User.email == REAL))
    create_session(db, real.id, now=NOW)
    db.add(Service(name="Admin Test Service", duration_minutes=30, price_idr=1))
    db.execute(Appointment.__table__.delete())
    db.commit()

    reset_demo(db, now=NOW + timedelta(days=30))
    db.commit()

    db.expire_all()
    assert db.scalar(select(User).where(User.email == REAL)) is None
    assert db.scalar(select(Service).where(Service.name == "Admin Test Service")) is None
    starts = db.scalars(select(Appointment.starts_at)).all()
    assert len(starts) > 100
    assert max(starts) > NOW + timedelta(days=40)  # regenerated around the new "now"


def test_reset_keeps_demo_users_and_their_sessions(api, db, demo_mode):
    seed_demo(db)
    r = login(api, STAFF, STAFF_PW)
    assert r.status_code == 200
    staff_id = db.scalar(select(User.id).where(User.email == STAFF))

    reset_demo(db, now=NOW)
    db.commit()

    assert db.scalar(select(User.id).where(User.email == STAFF)) == staff_id
    assert db.scalar(select(func.count()).select_from(UserSession)) == 1
    assert api.get("/auth/me").status_code == 200
    assert login(api, STAFF, STAFF_PW).status_code == 200


def test_reset_restores_hours_after_an_admin_closed_every_day(db, demo_mode):
    seed_demo(db)
    db.execute(Appointment.__table__.delete())
    from app.models import BusinessHour

    db.execute(BusinessHour.__table__.delete())
    db.commit()
    reset_demo(db, now=NOW)
    db.commit()
    assert db.scalar(select(func.count()).select_from(BusinessHour)) == 11


# --- throttle --------------------------------------------------------------------


def fail(api, email, n):
    for _ in range(n):
        assert login(api, email, "wrong-password").status_code == 401


def test_wrong_passwords_do_not_lock_a_demo_account(api, db, demo_mode):
    seed_demo(db)
    fail(api, STAFF, 10)
    assert login(api, STAFF, STAFF_PW).status_code == 200


def test_demo_failures_still_count_against_the_ip(api, db, demo_mode):
    seed_demo(db)
    add_real_user(db)
    fail(api, STAFF, 20)
    assert login(api, REAL, REAL_PW).status_code == 429


def test_demo_login_works_from_a_locked_ip(api, db, demo_mode):
    seed_demo(db)
    for i in range(20):
        assert login(api, f"ghost{i}@example.com", "x").status_code == 401
    assert login(api, STAFF, STAFF_PW).status_code == 200


def test_wrong_demo_password_from_a_locked_ip_is_refused(api, db, demo_mode):
    seed_demo(db)
    for i in range(20):
        assert login(api, f"ghost{i}@example.com", "x").status_code == 401
    r = login(api, STAFF, "wrong-password")
    assert r.status_code == 429
    assert r.headers["retry-after"] == "900"  # the refusal did not extend the lock


def test_real_accounts_still_lock_in_demo_mode(api, db, demo_mode):
    add_real_user(db)
    fail(api, REAL, 5)
    assert login(api, REAL, REAL_PW).status_code == 429


def test_demo_emails_lock_like_any_account_without_demo_mode(api, db):
    db.add(User(email=STAFF, full_name="Staff", role="staff",
                password_hash=hash_password("a-long-staff-password")))
    db.commit()
    fail(api, STAFF, 5)
    assert login(api, STAFF, "a-long-staff-password").status_code == 429


# --- guard -------------------------------------------------------------------------


def signed_in(api, email, password):
    r = login(api, email, password)
    assert r.status_code == 200
    return {"X-CSRF-Token": r.json()["csrf_token"]}


def test_demo_account_cannot_change_password(api, db, demo_mode):
    seed_demo(db)
    headers = signed_in(api, ADMIN, ADMIN_PW)
    r = api.post("/auth/password", headers=headers,
                 json={"current_password": ADMIN_PW, "new_password": "something-else-123"})
    assert r.status_code == 403
    assert login(api, ADMIN, ADMIN_PW).status_code == 200


def test_demo_account_cannot_sign_out_everyone(api, db, demo_mode):
    seed_demo(db)
    headers = signed_in(api, STAFF, STAFF_PW)
    assert api.post("/auth/logout-all", headers=headers).status_code == 403
    assert api.get("/auth/me").status_code == 200


def test_demo_account_can_still_sign_out_itself(api, db, demo_mode):
    seed_demo(db)
    headers = signed_in(api, STAFF, STAFF_PW)
    assert api.post("/auth/logout", headers=headers).status_code == 204


def test_real_account_can_change_password_in_demo_mode(api, db, demo_mode):
    add_real_user(db)
    headers = signed_in(api, REAL, REAL_PW)
    r = api.post("/auth/password", headers=headers,
                 json={"current_password": REAL_PW, "new_password": "a-brand-new-password"})
    assert r.status_code == 200


# --- demo mode turned off after a demo deployment -----------------------------------


def test_public_demo_passwords_are_refused_once_demo_mode_is_off(api, db, monkeypatch):
    seed_demo(db)  # hashes still hold the public passwords: nobody re-ran the seed
    monkeypatch.setattr(settings, "demo_mode", False)
    assert login(api, STAFF, STAFF_PW).status_code == 401
    assert login(api, ADMIN, ADMIN_PW).status_code == 401
    assert login(api, CUSTOMER, "demo-customer-2026").status_code == 200


def test_refused_public_password_counts_as_a_failed_login(api, db, monkeypatch):
    seed_demo(db)
    monkeypatch.setattr(settings, "demo_mode", False)
    for _ in range(5):
        login(api, ADMIN, ADMIN_PW)
    assert login(api, ADMIN, ADMIN_PW).status_code == 429


def test_seed_without_demo_mode_ends_sessions_opened_with_public_passwords(api, db):
    seed_demo(db)
    staff_id = db.scalar(select(User.id).where(User.email == STAFF))
    create_session(db, staff_id, now=NOW)
    db.commit()

    seed(db, passwords={}, now=NOW, demo_mode=False)
    db.commit()
    db.expire_all()
    sessions = db.scalars(select(UserSession).where(UserSession.user_id == staff_id)).all()
    assert sessions and all(s.revoked_at is not None for s in sessions)


# --- the deployment's start command -------------------------------------------------


def test_reset_leaves_all_three_demo_accounts_able_to_log_in(api, db, demo_mode):
    reset_demo(db, now=NOW)  # empty database, as on a first deploy
    db.commit()
    for email, password in ((CUSTOMER, "demo-customer-2026"), (STAFF, STAFF_PW), (ADMIN, ADMIN_PW)):
        assert login(api, email, password).status_code == 200, email


def test_reset_cli_if_demo_mode_says_staff_logins_are_off(capsys):
    assert reset_script.main(["--if-demo-mode"]) == 0
    assert "DEMO_MODE=true" in capsys.readouterr().out


# --- frontend buttons and backend accounts must agree -------------------------------


def test_frontend_demo_buttons_use_the_seeded_credentials():
    from pathlib import Path

    from app.demo import DEMO_ACCOUNTS

    source = (Path(__file__).resolve().parents[2]
              / "frontend" / "src" / "lib" / "demoAccounts.ts").read_text()
    for account in DEMO_ACCOUNTS:
        assert f"email: '{account.email}'" in source, account.email
        assert f"password: '{account.password}'" in source, account.email
