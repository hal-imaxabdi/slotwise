"""Public demo accounts for the portfolio deployment.

The passwords are published on purpose (landing page, README). Staff and admin
only get them when DEMO_MODE=true; the customer one has always been public.
"""
import hmac
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


_PUBLIC_PRIVILEGED = {account.email: account.password for account in (DEMO_STAFF, DEMO_ADMIN)}


def is_revoked_public_password(email: str, password: str) -> bool:
    """True when DEMO_MODE is off and this is a published staff/admin demo password.

    The seed revokes those hashes when demo mode is off, but only if it is re-run;
    this keeps them unusable from the moment DEMO_MODE is turned off.
    """
    public = _PUBLIC_PRIVILEGED.get(email)
    if settings.demo_mode or public is None:
        return False
    return hmac.compare_digest(password.encode("utf-8"), public.encode("utf-8"))
