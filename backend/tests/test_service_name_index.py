import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.dbutil import sqlstate
from app.models import Service


def test_database_rejects_names_differing_only_by_case(db):
    db.add(Service(name="Haircut", duration_minutes=30))
    db.flush()
    with pytest.raises(IntegrityError) as info:
        with db.begin_nested():
            db.add(Service(name="HAIRCUT", duration_minutes=30))
            db.flush()
    assert sqlstate(info.value) == "23505"


def test_database_allows_genuinely_different_names(db):
    db.add(Service(name="Haircut", duration_minutes=30))
    db.add(Service(name="Hair cut", duration_minutes=30))
    db.flush()
    assert db.query(Service).count() == 2


def test_case_insensitive_index_replaces_the_old_constraint(db):
    names = set(
        db.execute(
            text("SELECT indexname FROM pg_indexes WHERE tablename = 'services'")
        ).scalars()
    )
    assert "uq_services_name_lower" in names
    assert "uq_services_name" not in names
    