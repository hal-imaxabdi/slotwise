"""Create a user (the only way to add staff/admin accounts in v1).

Run from backend/ with the venv active:
    python -m scripts.create_user --email jane@example.com --name "Jane Doe" --role staff

The password is always prompted (never a CLI argument: arguments leak into
shell history and the process list).
"""
import argparse
import getpass
import sys

from app.database import SessionLocal
from app.models import Role
from app.user_admin import UserAdminError, create_user


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create a Slotwise user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True, help="full name")
    parser.add_argument("--role", required=True, choices=[r.value for r in Role])
    args = parser.parse_args(argv)

    password = getpass.getpass("Password: ")
    if password != getpass.getpass("Repeat password: "):
        print("error: passwords do not match", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        try:
            user = create_user(db, args.email, args.name, args.role, password)
            db.commit()
        except UserAdminError as exc:
            db.rollback()
            print(f"error: {exc}", file=sys.stderr)
            return 1
        print(f"created {user.role} {user.email} (id {user.id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
