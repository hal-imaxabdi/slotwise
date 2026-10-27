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

## Production settings (checked at startup)

| Variable          | Requirement                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| `ENVIRONMENT`     | `production`                                                                |
| `COOKIE_SECURE`   | `true`. The app refuses to start in production without it.                  |
| `ALLOWED_ORIGINS` | Comma-separated https origin(s) of the frontend; others get 403 on writes.  |

Login throttling keys on the client IP. Behind a reverse proxy that is the proxy's address
unless uvicorn runs with `--proxy-headers` and the proxy is trusted (to be settled in M10).
