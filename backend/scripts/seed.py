"""Idempotent seed for a fictional business.

Run from backend/ with the venv active:  python -m scripts.seed
Seeded users get an unusable password marker; the auth milestone sets real hashes.
"""
import os

from app.security.passwords import hash_password, verify_password
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Appointment, BusinessHour, Service, UnavailablePeriod, User
from app.slots import local_minute_to_utc

JAKARTA = ZoneInfo("Asia/Jakarta")
UNUSABLE_PASSWORD = "!unusable-until-auth-milestone"
DEMO_CUSTOMER_PASSWORD = "demo-customer-2026"  # public on purpose: fictional demo account
MIN_PRIVILEGED_PASSWORD_LENGTH = 12


def default_passwords() -> dict[str, str]:
    """Role -> password. Staff/admin only get one if set in the environment."""
    passwords = {"customer": DEMO_CUSTOMER_PASSWORD}
    for role, var in (("staff", "SEED_STAFF_PASSWORD"), ("admin", "SEED_ADMIN_PASSWORD")):
        value = os.environ.get(var)
        if value:
            if len(value) < MIN_PRIVILEGED_PASSWORD_LENGTH:
                raise SystemExit(f"{var} must be at least {MIN_PRIVILEGED_PASSWORD_LENGTH} characters")
            passwords[role] = value
    return passwords


def ensure_password(user: User, password: str | None) -> None:
    """Set a real hash only if the stored one is the marker or doesn't verify."""
    if password is None:
        return
    if user.password_hash == UNUSABLE_PASSWORD or not verify_password(password, user.password_hash):
        user.password_hash = hash_password(password)
        print(f"password: set for {user.email}")
SERVICES = [
    ("Classic Haircut", "Wash, cut and style.", 30, 75_000),
    ("Haircut and Beard Trim", "Full haircut plus beard shaping.", 60, 120_000),
    ("Hair Coloring", "Single-colour treatment, consultation included.", 120, 350_000),
]

USERS = [
    ("admin@barbershop.example", "Dewi Admin", "admin"),
    ("staff@barbershop.example", "Budi Barber", "staff"),
    ("demo.customer@example.com", "Demo Customer", "customer"),
]

# weekday (0=Mon): list of (open_minute, close_minute) in local time
HOURS = {
    **{d: [(540, 720), (780, 1020)] for d in range(0, 5)},  # Mon-Fri 09-12, 13-17
    5: [(540, 840)],                                         # Sat 09-14
}


def get_or_create_user(db: Session, email: str, full_name: str, role: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, full_name=full_name, role=role,
                    password_hash=UNUSABLE_PASSWORD)
        db.add(user)
        db.flush()
    return user


def get_or_create_service(db: Session, name: str, description: str,
                          minutes: int, price: int) -> Service:
    svc = db.scalar(select(Service).where(Service.name == name))
    if svc is None:
        svc = Service(name=name, description=description,
                      duration_minutes=minutes, price_idr=price)
        db.add(svc)
        db.flush()
    return svc


def is_empty(db: Session, model) -> bool:
    return db.scalar(select(func.count()).select_from(model)) == 0


def next_tuesday_at_least_two_days_ahead(today: date) -> date:
    days = (1 - today.weekday()) % 7
    if days < 2:
        days += 7
    return today + timedelta(days=days)


def at(day: date, hour: int, minute: int = 0) -> datetime:
    return local_minute_to_utc(day, hour * 60 + minute, JAKARTA)


def seed(db: Session, passwords: dict[str, str] | None = None) -> None:
    passwords = default_passwords() if passwords is None else passwords
    users = {role: get_or_create_user(db, e, n, role) for e, n, role in USERS}
    for role, user in users.items():
        ensure_password(user, passwords.get(role))
    services = {s[0]: get_or_create_service(db, *s) for s in SERVICES}

    if is_empty(db, BusinessHour):
        for weekday, intervals in HOURS.items():
            for open_m, close_m in intervals:
                db.add(BusinessHour(weekday=weekday, open_minute=open_m, close_minute=close_m))
        print("business hours: seeded")
    else:
        print("business hours: already present")
    now = datetime.now(timezone.utc)
    today = now.astimezone(JAKARTA).date()
    tuesday = next_tuesday_at_least_two_days_ahead(today)
    wednesday = tuesday + timedelta(days=1)
    customer, staff = users["customer"], users["staff"]
    cut = services["Classic Haircut"]
    cut_beard = services["Haircut and Beard Trim"]

    if is_empty(db, UnavailablePeriod):
        db.add(UnavailablePeriod(starts_at=at(wednesday, 13), ends_at=at(wednesday, 15),
                                 reason="Staff training", created_by_id=users["admin"].id))
        print(f"unavailable period: seeded ({wednesday} 13:00-15:00)")
    else:
        print("unavailable periods: already present")

    if is_empty(db, Appointment):
        db.add_all([
            Appointment(customer_id=customer.id, service_id=cut.id, created_by_id=customer.id,
                        starts_at=at(tuesday, 10), ends_at=at(tuesday, 10, 30)),
            Appointment(customer_id=customer.id, service_id=cut_beard.id, created_by_id=staff.id,
                        starts_at=at(tuesday, 10, 30), ends_at=at(tuesday, 11, 30)),
            Appointment(customer_id=customer.id, service_id=cut.id, created_by_id=customer.id,
                        starts_at=at(tuesday, 14), ends_at=at(tuesday, 14, 30),
                        status="cancelled", cancelled_at=now, cancelled_by_id=customer.id),
        ])
        print(f"appointments: seeded on {tuesday} (10:00, 10:30 booked; 14:00 cancelled)")
    else:
        print("appointments: already present")


def main() -> None:
    with SessionLocal() as db:
        seed(db)
        db.commit()


if __name__ == "__main__":
    main()