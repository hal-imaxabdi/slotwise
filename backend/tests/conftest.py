from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import settings  # adjust if your names differ

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def test_db_url() -> str:
    """Create/reset `<dev_db>_test`, run all migrations on it, return its URL.
    Refuses to touch anything that is not clearly a separate *_test database."""
    dev = make_url(str(settings.database_url))
    test = dev.set(database=f"{dev.database}_test")
    assert test.database.endswith("_test") and test.database != dev.database

    admin = create_engine(dev.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": test.database}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{test.database}"'))
    admin.dispose()

    url = test.render_as_string(hide_password=False)  # str(url) would mask the password
    reset = create_engine(url)
    with reset.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    reset.dispose()

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.attributes["database_url"] = url
    command.upgrade(cfg, "head")  # tests exercise the real migration, not create_all()
    return url


@pytest.fixture(scope="session")
def engine(test_db_url):
    eng = create_engine(test_db_url)
    yield eng
    eng.dispose()


@pytest.fixture()
def db(engine):
    with Session(engine, expire_on_commit=False) as session:
        yield session
        session.rollback()
    with engine.begin() as conn:
        conn.execute(
            text("TRUNCATE appointments, unavailable_periods, business_hours, services, users CASCADE")
        )
        