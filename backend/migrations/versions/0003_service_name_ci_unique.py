"""case-insensitive unique service names

Revision ID: 0003
Revises: 0002
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM services GROUP BY lower(name) HAVING count(*) > 1
            ) THEN
                RAISE EXCEPTION
                    'services contains names that differ only by case; rename them first';
            END IF;
        END
        $$
    """)
    op.execute("ALTER TABLE services DROP CONSTRAINT uq_services_name")
    op.execute("CREATE UNIQUE INDEX uq_services_name_lower ON services (lower(name))")


def downgrade() -> None:
    op.execute("DROP INDEX uq_services_name_lower")
    op.execute("ALTER TABLE services ADD CONSTRAINT uq_services_name UNIQUE (name)")
    