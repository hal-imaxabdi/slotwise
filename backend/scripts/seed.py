"""Idempotent seed for a fictional Jakarta barbershop.

Run from backend/ with the venv active:  python -m scripts.seed

Every date is relative to "now", so a fresh seed always shows about three weeks of
history and two weeks of upcoming bookings. Each table is only filled while it is
empty; in DEMO_MODE `python -m scripts.reset_demo` wipes and refills everything.
Seeded customers get an unusable password marker: only the demo accounts can log in.
"""
import os
import random
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.demo import DEMO_ACCOUNTS, DEMO_ADMIN, DEMO_CUSTOMER, DEMO_STAFF
from app.models import Appointment, AppointmentStatus, BusinessHour, Service, UnavailablePeriod, User
from app.security.passwords import hash_password, verify_password
from app.slots import local_minute_to_utc

JAKARTA = ZoneInfo("Asia/Jakarta")
UNUSABLE_PASSWORD = "!unusable-until-auth-milestone"
DEMO_CUSTOMER_PASSWORD = DEMO_CUSTOMER.password  # public on purpose: fictional demo account
MIN_PRIVILEGED_PASSWORD_LENGTH = 12
PUBLIC_PRIVILEGED_PASSWORDS = {"staff": DEMO_STAFF.password, "admin": DEMO_ADMIN.password}


def default_passwords(demo_mode: bool | None = None) -> dict[str, str]:
    """Role -> password. Staff/admin get one from the environment, or the public
    demo passwords in DEMO_MODE (never both)."""
    demo_mode = settings.demo_mode if demo_mode is None else demo_mode
    passwords = {"customer": DEMO_CUSTOMER_PASSWORD}
    from_env = {
        role: os.environ.get(var)
        for role, var in (("staff", "SEED_STAFF_PASSWORD"), ("admin", "SEED_ADMIN_PASSWORD"))
    }
    if demo_mode:
        if any(from_env.values()):
            raise SystemExit("DEMO_MODE cannot be combined with SEED_STAFF_PASSWORD/SEED_ADMIN_PASSWORD")
        return passwords | PUBLIC_PRIVILEGED_PASSWORDS
    for role, value in from_env.items():
        if value:
            if len(value) < MIN_PRIVILEGED_PASSWORD_LENGTH:
                var = f"SEED_{role.upper()}_PASSWORD"
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


def revoke_public_password(user: User) -> None:
    """Outside DEMO_MODE, staff/admin must not keep a published demo password."""
    public = PUBLIC_PRIVILEGED_PASSWORDS.get(user.role)
    if public is not None and verify_password(public, user.password_hash):
        user.password_hash = UNUSABLE_PASSWORD
        print(f"password: public demo password revoked for {user.email}")


# name, description, minutes, price (IDR), active
SERVICES = [
    ("Classic Haircut", "Wash, cut and style.", 30, 75_000, True),
    ("Haircut and Beard Trim", "Full haircut plus beard shaping.", 60, 120_000, True),
    ("Hair Coloring", "Single-colour treatment, consultation included.", 120, 350_000, True),
    ("Beard Trim and Shape", "Clipper trim with a straight-razor line-up.", 30, 50_000, True),
    ("Hot Towel Shave", "Traditional straight-razor shave with hot towels and balm.", 30, 85_000, True),
    ("Kids Haircut", "For children under 12: cut and style.", 30, 60_000, True),
    ("Hair and Scalp Treatment", "Deep-cleansing scalp treatment, massage and wash.", 60, 150_000, True),
    ("Grey Blending", "Subtle colour that softens grey and keeps it natural.", 60, 180_000, True),
    ("Keratin Smoothing", "Frizz-control treatment. Paused while we restock.", 120, 450_000, False),
]

USERS = [(account.email, account.full_name, account.role) for account in DEMO_ACCOUNTS]

CUSTOMERS = [
    ("andi.pratama@example.com", "Andi Pratama"),
    ("rizky.hidayat@example.com", "Rizky Hidayat"),
    ("fajar.nugroho@example.com", "Fajar Nugroho"),
    ("dimas.saputra@example.com", "Dimas Saputra"),
    ("agus.setiawan@example.com", "Agus Setiawan"),
    ("bayu.kurniawan@example.com", "Bayu Kurniawan"),
    ("hendra.wijaya@example.com", "Hendra Wijaya"),
    ("yusuf.ramadhan@example.com", "Yusuf Ramadhan"),
    ("arif.santoso@example.com", "Arif Santoso"),
    ("eko.prasetyo@example.com", "Eko Prasetyo"),
    ("galih.permana@example.com", "Galih Permana"),
    ("rafi.maulana@example.com", "Rafi Maulana"),
    ("teguh.firmansyah@example.com", "Teguh Firmansyah"),
    ("wahyu.gunawan@example.com", "Wahyu Gunawan"),
    ("siti.rahmawati@example.com", "Siti Rahmawati"),
    ("putri.lestari@example.com", "Putri Lestari"),
    ("nadia.anggraini@example.com", "Nadia Anggraini"),
    ("kevin.tanoto@example.com", "Kevin Tanoto"),
]

# weekday (0=Mon): list of (open_minute, close_minute) in local time
HOURS = {
    **{d: [(540, 720), (780, 1020)] for d in range(0, 5)},  # Mon-Fri 09-12, 13-17
    5: [(540, 840)],                                         # Sat 09-14
}

# days from today (moved forward to a weekday), local start hour, end hour, reason
CLOSURES = [
    (-10, 13, 17, "Staff training"),
    (6, 9, 12, "Equipment maintenance"),
    (11, 9, 17, "Team day out"),
]

PAST_DAYS = 21
FUTURE_DAYS = 14
RANDOM_SEED = 2026  # same "now" -> same data, so tests are reproducible
RECENT_UNMARKED = 3  # newest started appointments left "booked" for staff to mark

# Relative popularity: haircuts fill most of a barbershop's day.
SERVICE_WEIGHTS = {
    "Classic Haircut": 30,
    "Haircut and Beard Trim": 22,
    "Beard Trim and Shape": 12,
    "Hot Towel Shave": 8,
    "Kids Haircut": 8,
    "Grey Blending": 6,
    "Hair and Scalp Treatment": 6,
    "Hair Coloring": 4,
}

NOTES = [
    "First visit.",
    "Prefers scissors over clippers.",
    "Short fade on the sides, keep the length on top.",
    "Might be ten minutes late.",
    "Same as last time, please.",
    "Sensitive skin: no alcohol aftershave.",
]


def get_or_create_user(db: Session, email: str, full_name: str, role: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, full_name=full_name, role=role,
                    password_hash=UNUSABLE_PASSWORD)
        db.add(user)
        db.flush()
    return user


def get_or_create_service(db: Session, name: str, description: str,
                          minutes: int, price: int, active: bool = True) -> Service:
    svc = db.scalar(select(Service).where(Service.name == name))
    if svc is None:
        svc = Service(name=name, description=description,
                      duration_minutes=minutes, price_idr=price, is_active=active)
        db.add(svc)
        db.flush()
    return svc


def is_empty(db: Session, model) -> bool:
    return db.scalar(select(func.count()).select_from(model)) == 0


def at(day: date, hour: int, minute: int = 0) -> datetime:
    return local_minute_to_utc(day, hour * 60 + minute, JAKARTA)


def next_weekday(day: date) -> date:
    while day.weekday() >= 5:
        day += timedelta(days=1)
    return day


def occupancy(days_from_today: int) -> float:
    """Chance that a free 30-minute step gets a booking: busy past, thinner future."""
    if days_from_today < 0:
        return 0.6
    return max(0.15, 0.45 - 0.02 * days_from_today)


Window = tuple[datetime, datetime]


def plan_slots(
    rng: random.Random,
    today: date,
    hours: dict[int, list[tuple[int, int]]],
    services: dict[str, Service],
    closures: list[Window],
) -> list[tuple[Service, datetime, datetime]]:
    """Walk each open interval on the 30-minute grid and place non-overlapping bookings
    that fit inside business hours and avoid closures."""
    names = [name for name in SERVICE_WEIGHTS if services[name].is_active]
    weights = [SERVICE_WEIGHTS[name] for name in names]
    short = [services[name] for name in names if services[name].duration_minutes == 30]
    planned = []
    for offset in range(-PAST_DAYS, FUTURE_DAYS + 1):
        day = today + timedelta(days=offset)
        for open_minute, close_minute in hours.get(day.weekday(), []):
            minute = open_minute
            while minute < close_minute:
                if rng.random() >= occupancy(offset):
                    minute += 30
                    continue
                service = services[rng.choices(names, weights)[0]]
                if minute + service.duration_minutes > close_minute:
                    service = rng.choice(short)  # 30 minutes always fits on the grid
                starts = local_minute_to_utc(day, minute, JAKARTA)
                ends = starts + timedelta(minutes=service.duration_minutes)
                if any(starts < c_end and c_start < ends for c_start, c_end in closures):
                    minute += 30
                    continue
                planned.append((service, starts, ends))
                minute += service.duration_minutes
    return planned


def build_appointments(
    rng: random.Random,
    now: datetime,
    planned: list[tuple[Service, datetime, datetime]],
    customers: list[User],
    demo_customer: User,
    staff: User,
) -> list[Appointment]:
    appointments = []
    for service, starts, ends in planned:
        customer = rng.choice(customers)
        roll = rng.random()
        if starts <= now:
            status = (AppointmentStatus.CANCELLED if roll < 0.1
                      else AppointmentStatus.NO_SHOW if roll < 0.18
                      else AppointmentStatus.COMPLETED)
        else:
            status = AppointmentStatus.CANCELLED if roll < 0.08 else AppointmentStatus.BOOKED
        appointments.append(Appointment(
            customer_id=customer.id,
            service_id=service.id,
            starts_at=starts,
            ends_at=ends,
            status=status.value,
            notes=rng.choice(NOTES) if rng.random() < 0.25 else "",
            created_by_id=staff.id if rng.random() < 0.2 else customer.id,
        ))

    started = [a for a in appointments
               if a.starts_at <= now and a.status != AppointmentStatus.CANCELLED]
    for appointment in sorted(started, key=lambda a: a.starts_at)[-RECENT_UNMARKED:]:
        appointment.status = AppointmentStatus.BOOKED.value

    give_demo_customer_bookings(rng, now, appointments, demo_customer)

    for appointment in appointments:
        if appointment.status == AppointmentStatus.CANCELLED:
            if appointment.starts_at <= now:
                hours_before = rng.randint(2, 72)
                appointment.cancelled_at = appointment.starts_at - timedelta(hours=hours_before)
            else:
                appointment.cancelled_at = now - timedelta(hours=rng.randint(1, 48))
            by_staff = rng.random() < 0.25
            appointment.cancelled_by_id = staff.id if by_staff else appointment.customer_id
    return appointments


def give_demo_customer_bookings(
    rng: random.Random, now: datetime, appointments: list[Appointment], demo: User
) -> None:
    """History, one upcoming visit that can still be changed (>24h away) and, when the
    calendar allows, one inside the 24h window that shows the change rule."""
    def claim(appointment: Appointment) -> None:
        appointment.customer_id = demo.id
        appointment.created_by_id = demo.id

    upcoming = [a for a in appointments if a.status == AppointmentStatus.BOOKED and a.starts_at > now]
    changeable = [a for a in upcoming if a.starts_at - now >= timedelta(hours=48)]
    locked = [a for a in upcoming if timedelta(hours=1) <= a.starts_at - now < timedelta(hours=24)]
    if changeable:
        claim(changeable[0])
    if locked:
        claim(locked[0])

    completed = [a for a in appointments if a.status == AppointmentStatus.COMPLETED]
    for appointment in rng.sample(completed, min(3, len(completed))):
        claim(appointment)
    cancelled = [a for a in appointments
                 if a.status == AppointmentStatus.CANCELLED and a.starts_at <= now]
    if cancelled:
        claim(rng.choice(cancelled))


def seed(
    db: Session,
    passwords: dict[str, str] | None = None,
    now: datetime | None = None,
    demo_mode: bool | None = None,
) -> None:
    demo_mode = settings.demo_mode if demo_mode is None else demo_mode
    passwords = default_passwords(demo_mode) if passwords is None else passwords
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(JAKARTA).date()
    rng = random.Random(RANDOM_SEED)

    users = {role: get_or_create_user(db, e, n, role) for e, n, role in USERS}
    for role, user in users.items():
        password = passwords.get(role)
        ensure_password(user, password)
        if password is None and not demo_mode:
            revoke_public_password(user)
    customers = [get_or_create_user(db, e, n, "customer") for e, n in CUSTOMERS]
    services = {s[0]: get_or_create_service(db, *s) for s in SERVICES}

    if is_empty(db, BusinessHour):
        for weekday, intervals in HOURS.items():
            for open_m, close_m in intervals:
                db.add(BusinessHour(weekday=weekday, open_minute=open_m, close_minute=close_m))
        db.flush()
        print("business hours: seeded")
    else:
        print("business hours: already present")

    if is_empty(db, UnavailablePeriod):
        for offset, start_hour, end_hour, reason in CLOSURES:
            day = next_weekday(today + timedelta(days=offset))
            db.add(UnavailablePeriod(starts_at=at(day, start_hour), ends_at=at(day, end_hour),
                                     reason=reason, created_by_id=users["admin"].id))
        db.flush()
        print(f"unavailable periods: seeded {len(CLOSURES)}")
    else:
        print("unavailable periods: already present")

    if is_empty(db, Appointment):
        # Plan around what is actually stored, in case an admin changed the defaults.
        hours: dict[int, list[tuple[int, int]]] = {}
        for h in db.scalars(select(BusinessHour).order_by(BusinessHour.open_minute)):
            hours.setdefault(h.weekday, []).append((h.open_minute, h.close_minute))
        closures = [(p.starts_at, p.ends_at) for p in db.scalars(select(UnavailablePeriod))]
        planned = plan_slots(rng, today, hours, services, closures)
        appointments = build_appointments(
            rng, now, planned, customers, users["customer"], users["staff"]
        )
        db.add_all(appointments)
        db.flush()
        counts = Counter(a.status for a in appointments)
        print(f"appointments: seeded {len(appointments)} ({dict(sorted(counts.items()))})")
    else:
        print("appointments: already present")


def main() -> None:
    with SessionLocal() as db:
        seed(db)
        db.commit()


if __name__ == "__main__":
    main()
