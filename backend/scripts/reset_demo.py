"""Wipe all business data and reseed it. Refuses unless DEMO_MODE=true.

Run from backend/ with the venv active:  python -m scripts.reset_demo

Deletes every appointment, closure, business hour, service and non-demo user
(registered visitors included), then runs the seed with dates relative to now.
The demo accounts keep their ids and sessions, so a visitor mid-tour is not
signed out.

--if-demo-mode exits quietly instead of refusing when DEMO_MODE is off, so the
command can sit in a start command on every deployment.
"""
import argparse
import sys
from datetime import datetime, timezone

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.demo import DEMO_ACCOUNTS, DEMO_EMAILS
from app.locks import lock_schedule_exclusive
from app.models import Appointment, BusinessHour, Service, UnavailablePeriod, User, UserSession
from scripts.seed import seed


class DemoModeRequired(Exception):
    """reset_demo was called while DEMO_MODE is off."""


def reset_demo(db: Session, now: datetime | None = None) -> None:
    """Delete and reseed inside the caller's transaction. The caller commits."""
    if not settings.demo_mode:
        raise DemoModeRequired()

    lock_schedule_exclusive(db)  # in-flight bookings finish first; new ones wait for the commit

    keep = select(User.id).where(User.email.in_(DEMO_EMAILS))
    db.execute(delete(Appointment))
    db.execute(delete(UnavailablePeriod))
    db.execute(delete(BusinessHour))
    db.execute(delete(Service))
    db.execute(delete(UserSession).where(UserSession.user_id.not_in(keep)))
    db.execute(delete(User).where(User.id.not_in(keep)))
    db.execute(text("DELETE FROM login_throttle"))

    for account in DEMO_ACCOUNTS:
        db.execute(
            update(User)
            .where(User.email == account.email)
            .values(full_name=account.full_name, role=account.role, is_active=True)
        )
    db.expire_all()

    seed(db, now=now, demo_mode=True)

    db.flush()
    found = set(db.scalars(select(User.email).where(User.email.in_(DEMO_EMAILS))))
    if found != DEMO_EMAILS:
        raise RuntimeError(f"demo accounts missing after reseed: {sorted(DEMO_EMAILS - found)}")


def summary(db: Session) -> str:
    def count(model) -> int:
        return db.scalar(select(func.count()).select_from(model))

    return (f"{count(User)} users, {count(Service)} services, "
            f"{count(Appointment)} appointments")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Wipe and reseed the Slotwise demo data.")
    parser.add_argument(
        "--if-demo-mode",
        action="store_true",
        help="do nothing (exit 0) when DEMO_MODE is off, instead of refusing",
    )
    args = parser.parse_args(argv)

    if not settings.demo_mode:
        if args.if_demo_mode:
            print("reset_demo: DEMO_MODE is off, nothing to do "
                  "(staff/admin demo logins are refused; set DEMO_MODE=true for the public demo)")
            return 0
        print("error: refusing to wipe data because DEMO_MODE is not true", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        reset_demo(db, now=datetime.now(timezone.utc))
        db.commit()
        print(f"reset_demo: done ({summary(db)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
