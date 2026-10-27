import hashlib
import math
from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

EMAIL_MAX_FAILURES = 5
IP_MAX_FAILURES = 20
WINDOW = timedelta(minutes=15)
LOCKOUT = timedelta(minutes=15)

_MAX_FAILURES = {"email": EMAIL_MAX_FAILURES, "ip": IP_MAX_FAILURES}

Key = tuple[str, str]

# One atomic statement: no read-then-write race between concurrent guesses.
# Inside DO UPDATE, "login_throttle.col" is the OLD row value for every expression.
_RECORD_FAILURE = text("""
    INSERT INTO login_throttle (kind, key, failures, window_start, locked_until)
    VALUES (:kind, :key, 1, :now, NULL)
    ON CONFLICT (kind, key) DO UPDATE SET
        failures = CASE
            WHEN login_throttle.window_start <= :cutoff THEN 1
            ELSE login_throttle.failures + 1
        END,
        window_start = CASE
            WHEN login_throttle.window_start <= :cutoff THEN :now
            ELSE login_throttle.window_start
        END,
        locked_until = CASE
            WHEN (
                CASE WHEN login_throttle.window_start <= :cutoff
                     THEN 1 ELSE login_throttle.failures + 1 END
            ) >= :max_failures
            THEN :locked_until
            ELSE login_throttle.locked_until
        END
""")

_LOCKED_UNTIL = text("""
    SELECT locked_until FROM login_throttle
    WHERE kind = :kind AND key = :key AND locked_until > :now
""")

_RESET = text("DELETE FROM login_throttle WHERE kind = :kind AND key = :key")


def email_key(email: str) -> str:
    """Hash so the table never stores email addresses."""
    return hashlib.sha256(email.encode("utf-8")).hexdigest()


def login_keys(email: str, ip: str) -> list[Key]:
    return [("email", email_key(email)), ("ip", ip)]


def lock_remaining_seconds(db: Session, keys: list[Key], now: datetime) -> int:
    """0 if none of the keys is locked, else seconds until the longest lock ends."""
    longest = 0
    for kind, key in keys:
        until = db.scalar(_LOCKED_UNTIL, {"kind": kind, "key": key, "now": now})
        if until is not None:
            longest = max(longest, math.ceil((until - now).total_seconds()))
    return longest


def record_failure(db: Session, keys: list[Key], now: datetime) -> None:
    for kind, key in keys:
        db.execute(
            _RECORD_FAILURE,
            {
                "kind": kind,
                "key": key,
                "now": now,
                "cutoff": now - WINDOW,
                "max_failures": _MAX_FAILURES[kind],
                "locked_until": now + LOCKOUT,
            },
        )


def reset(db: Session, kind: str, key: str) -> None:
    db.execute(_RESET, {"kind": kind, "key": key})
    