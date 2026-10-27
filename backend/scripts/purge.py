"""Delete expired sessions and stale login-throttle rows. Safe to run any time.

Run from backend/ with the venv active:  python -m scripts.purge
"""
from datetime import UTC, datetime

from app.database import SessionLocal
from app.maintenance import purge_all


def main() -> int:
    with SessionLocal() as db:
        sessions, throttle_rows = purge_all(db, datetime.now(UTC))
        db.commit()
    print(f"purged {sessions} expired sessions and {throttle_rows} stale throttle rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
