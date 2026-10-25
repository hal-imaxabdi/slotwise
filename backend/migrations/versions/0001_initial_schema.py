"""initial schema: users, services, business_hours, unavailable_periods, appointments

Revision ID: 0001
Revises:
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

TS = "timestamptz NOT NULL DEFAULT now()"


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.execute(f"""
        CREATE TABLE users (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            email varchar(254) NOT NULL,
            password_hash varchar(255) NOT NULL,
            full_name varchar(120) NOT NULL,
            role varchar(16) NOT NULL DEFAULT 'customer',
            is_active boolean NOT NULL DEFAULT true,
            created_at {TS},
            updated_at {TS},
            CONSTRAINT pk_users PRIMARY KEY (id),
            CONSTRAINT uq_users_email UNIQUE (email),
            CONSTRAINT ck_users_email_lowercase CHECK (email = lower(email)),
            CONSTRAINT ck_users_role_valid CHECK (role IN ('customer', 'staff', 'admin')),
            CONSTRAINT ck_users_full_name_not_blank CHECK (length(btrim(full_name)) > 0)
        )
    """)

    op.execute(f"""
        CREATE TABLE services (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            name varchar(120) NOT NULL,
            description text NOT NULL DEFAULT '',
            duration_minutes smallint NOT NULL,
            price_idr integer NOT NULL DEFAULT 0,
            is_active boolean NOT NULL DEFAULT true,
            created_at {TS},
            updated_at {TS},
            CONSTRAINT pk_services PRIMARY KEY (id),
            CONSTRAINT uq_services_name UNIQUE (name),
            CONSTRAINT ck_services_duration_valid CHECK (
                duration_minutes > 0 AND duration_minutes <= 480 AND mod(duration_minutes, 30) = 0
            ),
            CONSTRAINT ck_services_price_non_negative CHECK (price_idr >= 0)
        )
    """)

    op.execute(f"""
        CREATE TABLE business_hours (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            weekday smallint NOT NULL,
            open_minute smallint NOT NULL,
            close_minute smallint NOT NULL,
            created_at {TS},
            updated_at {TS},
            CONSTRAINT pk_business_hours PRIMARY KEY (id),
            CONSTRAINT ck_business_hours_weekday_valid CHECK (weekday BETWEEN 0 AND 6),
            CONSTRAINT ck_business_hours_range_valid CHECK (
                open_minute >= 0 AND close_minute <= 1440 AND open_minute < close_minute
            ),
            CONSTRAINT ck_business_hours_slot_aligned CHECK (
                mod(open_minute, 30) = 0 AND mod(close_minute, 30) = 0
            ),
            CONSTRAINT ex_business_hours_no_overlap EXCLUDE USING gist (
                weekday WITH =,
                int4range(CAST(open_minute AS integer), CAST(close_minute AS integer)) WITH &&
            )
        )
    """)

    op.execute(f"""
        CREATE TABLE unavailable_periods (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            starts_at timestamptz NOT NULL,
            ends_at timestamptz NOT NULL,
            reason varchar(200) NOT NULL DEFAULT '',
            created_by_id uuid NOT NULL,
            created_at {TS},
            updated_at {TS},
            CONSTRAINT pk_unavailable_periods PRIMARY KEY (id),
            CONSTRAINT fk_unavailable_periods_created_by_id_users
                FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE RESTRICT,
            CONSTRAINT ck_unavailable_periods_ends_after_starts CHECK (ends_at > starts_at),
            CONSTRAINT ck_unavailable_periods_slot_aligned CHECK (
                mod(extract(epoch from starts_at), 1800) = 0
                AND mod(extract(epoch from ends_at), 1800) = 0
            )
        )
    """)
    op.execute("CREATE INDEX ix_unavailable_periods_starts_at ON unavailable_periods (starts_at)")

    op.execute(f"""
        CREATE TABLE appointments (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            customer_id uuid NOT NULL,
            service_id uuid NOT NULL,
            starts_at timestamptz NOT NULL,
            ends_at timestamptz NOT NULL,
            status varchar(16) NOT NULL DEFAULT 'booked',
            notes text NOT NULL DEFAULT '',
            created_by_id uuid NOT NULL,
            cancelled_at timestamptz,
            cancelled_by_id uuid,
            created_at {TS},
            updated_at {TS},
            CONSTRAINT pk_appointments PRIMARY KEY (id),
            CONSTRAINT fk_appointments_customer_id_users
                FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE RESTRICT,
            CONSTRAINT fk_appointments_service_id_services
                FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE RESTRICT,
            CONSTRAINT fk_appointments_created_by_id_users
                FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE RESTRICT,
            CONSTRAINT fk_appointments_cancelled_by_id_users
                FOREIGN KEY (cancelled_by_id) REFERENCES users (id) ON DELETE RESTRICT,
            CONSTRAINT ck_appointments_ends_after_starts CHECK (ends_at > starts_at),
            CONSTRAINT ck_appointments_status_valid
                CHECK (status IN ('booked', 'cancelled', 'completed', 'no_show')),
            CONSTRAINT ck_appointments_cancelled_at_matches_status
                CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
            CONSTRAINT ck_appointments_slot_aligned CHECK (
                mod(extract(epoch from starts_at), 1800) = 0
                AND mod(extract(epoch from ends_at), 1800) = 0
            ),
            CONSTRAINT ex_appointments_no_overlap EXCLUDE USING gist (
                tstzrange(starts_at, ends_at, '[)') WITH &&
            ) WHERE (status <> 'cancelled')
        )
    """)
    op.execute(
        "CREATE INDEX ix_appointments_customer_id_starts_at ON appointments (customer_id, starts_at)"
    )
    op.execute("CREATE INDEX ix_appointments_starts_at ON appointments (starts_at)")


def downgrade() -> None:
    op.execute("DROP TABLE appointments")
    op.execute("DROP TABLE unavailable_periods")
    op.execute("DROP TABLE business_hours")
    op.execute("DROP TABLE services")
    op.execute("DROP TABLE users")
    op.execute("DROP EXTENSION IF EXISTS btree_gist")
    