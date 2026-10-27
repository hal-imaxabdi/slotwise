from datetime import datetime, timedelta

from sqlalchemy import delete, text
from sqlalchemy.orm import Session

from app.models import UserSession

# Keep recently expired sessions a while for investigating incidents.
# The TTL caps a session's life, so revoked sessions are purged once expired too.
SESSION_RETENTION = timedelta(days=7)

# A throttle row is garbage once its counting window is over and no lock is active.
_PURGE_THROTTLE = text("""
    DELETE FROM login_throttle
    WHERE window_start <= :cutoff
      AND (locked_until IS NULL OR locked_until <= :now)
""")


def purge_expired_sessions(
    db: Session, now: datetime, retention: timedelta = SESSION_RETENTION
) -> int:
    result = db.execute(delete(UserSession).where(UserSession.expires_at < now - retention))
    return result.rowcount


def purge_stale_throttle(db: Session, now: datetime) -> int:
    from app.throttle import WINDOW

    result = db.execute(_PURGE_THROTTLE, {"cutoff": now - WINDOW, "now": now})
    return result.rowcount


def purge_all(db: Session, now: datetime) -> tuple[int, int]:
    """Returns (sessions_deleted, throttle_rows_deleted). The caller commits."""
    return purge_expired_sessions(db, now), purge_stale_throttle(db, now)
