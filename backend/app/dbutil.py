"""Small database helpers shared across service modules."""

from sqlalchemy.exc import IntegrityError


def sqlstate(exc: IntegrityError) -> str | None:
    """Return the PostgreSQL SQLSTATE code of an IntegrityError, if any.

    psycopg 3 exposes `sqlstate`; psycopg 2 exposes `pgcode`.
    """
    orig = exc.orig
    return getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None)
