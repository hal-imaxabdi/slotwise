# Operations

All commands run from `backend/` with the venv active (prompt starts with `(.venv)`).

## Create a user (staff, admin or customer)

There are no HTTP user-management endpoints in v1. Accounts are created from the server shell:

```bash
python -m scripts.create_user --email jane@example.com --name "Jane Doe" --role staff
```

The password is prompted twice and never passed as an argument (arguments leak into shell
history and `ps`). It must be 12-128 characters. Roles: `customer`, `staff`, `admin`.

## Purge expired data

```bash
python -m scripts.purge
```

Deletes sessions that expired more than 7 days ago and login-throttle rows whose window is over
and which are not locked. Safe to run at any time; schedule it daily (cron setup is part of M10).

## Seed and demo mode

```bash
python -m scripts.seed          # idempotent: fills each table only while it is empty
python -m scripts.reset_demo    # DEMO_MODE=true only: wipes ALL data and reseeds it
```

The seed creates a fictional Jakarta barbershop: services, 18 customers, closures and about
150 appointments from three weeks back to two weeks ahead, all relative to the current time.

With `DEMO_MODE=true` the staff and admin accounts get the public passwords in
`backend/app/demo.py`, the three demo accounts skip the per-email login lock (the per-IP
counter still applies) and cannot change their password or sign out other sessions.
`reset_demo` deletes every non-demo user, so never enable demo mode with real customers.
`reset_demo --if-demo-mode` does nothing when demo mode is off, so it can stay in a start
command. Running the seed with demo mode off revokes the public staff/admin passwords.

## Production settings (checked at startup)

| Variable          | Requirement                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| `ENVIRONMENT`     | `production`                                                                |
| `COOKIE_SECURE`   | `true`. The app refuses to start in production without it.                  |
| `ALLOWED_ORIGINS` | Comma-separated https origin(s) of the frontend; others get 403 on writes.  |

Login throttling keys on the client IP. Behind a reverse proxy that is the proxy's address
unless uvicorn runs with `--proxy-headers` and the proxy is trusted (to be settled in M10).

## Deploying

The frontend is a static Vite build on Vercel; `frontend/vercel.json` proxies `/api/*` to the
API on Render and sends every other path to `index.html`.

### Render (API, root directory `backend/`)

| Setting | Value |
|---|---|
| Build command | `pip install -r requirements.txt` |
| Start command | `alembic upgrade head && python -m scripts.reset_demo --if-demo-mode && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

Environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Render Postgres connection string |
| `ENVIRONMENT` | `production` |
| `COOKIE_SECURE` | `true` |
| `ALLOWED_ORIGINS` | the Vercel origin, e.g. `https://slotwise-mocha.vercel.app` |
| `DEMO_MODE` | `true` for the public demo; leave unset anywhere real customers book |

Do not set `SEED_STAFF_PASSWORD` or `SEED_ADMIN_PASSWORD` together with `DEMO_MODE`: the reset
refuses to run and the service will not start.

On the free plan the instance sleeps after about 15 minutes without traffic. Every cold start
runs the start command again, so the demo data is rebuilt around the current date each time.
The landing page pings `/api/health` on load and shows a "waking up" message while it waits.

### Vercel (frontend, root directory `frontend/`)

| Variable | Value |
|---|---|
| `VITE_SITE_URL` | the public URL, e.g. `https://slotwise-mocha.vercel.app` |

With `VITE_SITE_URL` set, the build adds the canonical link, Open Graph URLs and a
`sitemap.xml`; without it they are left out rather than pointing at the wrong domain.
`robots.txt` is always generated and keeps the signed-in app pages out of search results.

## Accounts and data deletion

Customers can delete their own account (`POST /auth/delete-account`, password required). The
user row is anonymised and deactivated rather than removed, because past appointments are
business records: email, name, password and booking notes are erased, future bookings are
cancelled and every session is revoked. Staff and admin accounts are removed by the owner.
