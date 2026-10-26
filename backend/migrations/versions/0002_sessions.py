"""auth sessions table

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE user_sessions (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL,
            token_hash varchar(64) NOT NULL,
            csrf_token varchar(64) NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            expires_at timestamptz NOT NULL,
            revoked_at timestamptz,
            CONSTRAINT pk_user_sessions PRIMARY KEY (id),
            CONSTRAINT fk_user_sessions_user_id_users
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
            CONSTRAINT uq_user_sessions_token_hash UNIQUE (token_hash),
            CONSTRAINT ck_user_sessions_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
            CONSTRAINT ck_user_sessions_csrf_token_length CHECK (length(csrf_token) >= 32),
            CONSTRAINT ck_user_sessions_expires_after_created CHECK (expires_at > created_at)
        )
    """)
    op.execute("CREATE INDEX ix_user_sessions_user_id ON user_sessions (user_id)")
    op.execute("CREATE INDEX ix_user_sessions_expires_at ON user_sessions (expires_at)")


def downgrade() -> None:
    op.execute("DROP TABLE user_sessions")
    