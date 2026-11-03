"""Public demo accounts for the portfolio deployment.

The passwords are published on purpose (landing page, README). Staff and admin
only get them when DEMO_MODE=true; the customer one has always been public.
"""
from dataclasses import dataclass

from app.config import settings


@dataclass(frozen=True)
class DemoAccount:
    email: str
    full_name: str
    role: str
    password: str


DEMO_CUSTOMER = DemoAccount(
    "demo.customer@example.com", "Demo Customer", "customer", "demo-customer-2026"
)
DEMO_STAFF = DemoAccount("staff@barbershop.example", "Budi Barber", "staff", "demo-staff-2026")
DEMO_ADMIN = DemoAccount("admin@barbershop.example", "Dewi Admin", "admin", "demo-admin-2026")

DEMO_ACCOUNTS = (DEMO_ADMIN, DEMO_STAFF, DEMO_CUSTOMER)
DEMO_EMAILS = frozenset(account.email for account in DEMO_ACCOUNTS)


def is_demo_account(email: str) -> bool:
    """True only in DEMO_MODE, for one of the published accounts (email already normalised)."""
    return settings.demo_mode and email in DEMO_EMAILS
