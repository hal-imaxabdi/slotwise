"""login throttle counters

Revision ID: 0004
Revises: 0003
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE login_throttle (
            kind text NOT NULL,
            key text NOT NULL,
            failures integer NOT NULL DEFAULT 0,
            window_start timestamptz NOT NULL,
            locked_until timestamptz,
            CONSTRAINT pk_login_throttle PRIMARY KEY (kind, key),
            CONSTRAINT ck_login_throttle_kind CHECK (kind IN ('email', 'ip')),
            CONSTRAINT ck_login_throttle_failures CHECK (failures >= 0)
        )
    """)
    # Lets the purge job in item 9 find old rows without a full scan.
    op.execute("CREATE INDEX ix_login_throttle_window_start ON login_throttle (window_start)")


def downgrade() -> None:
    op.execute("DROP TABLE login_throttle")
    