# Slotwise

Slotwise is a full-stack appointment booking system for small businesses. Customers browse services and book a free time slot. Staff manage the day's schedule. Admins set up services and opening hours.

It covers the parts of booking software that are easy to get wrong: time zones, 30-minute slot generation from opening hours, closures that block time, conflict-free booking, a 24-hour change rule, and role-based access that is enforced on the server.

## Features

| Role | What they can do |
| --- | --- |
| **Customer** | Browse services, pick a date and a free time, book, cancel or reschedule, and see their appointment history |
| **Staff** | Everything a customer can do, plus: view and filter all appointments, cancel or reschedule, mark appointments completed or no-show, book on behalf of a customer, and add or remove closures that block booking |
| **Admin** | Everything staff can do, plus: create, edit, activate and deactivate services, and set weekly business hours (each day is saved on its own) |

How booking behaves:

- Time slots are generated in 30-minute steps from the business hours, minus closures and existing appointments.
- If two people try to book the same slot, the server rejects the second request with **HTTP 409** and the interface reloads the available times.
- Customers can cancel or reschedule only if the appointment is at least 24 hours away. The server decides this; the interface only hides what it can.
- The business time zone is `Asia/Jakarta`. Times are stored in UTC and shown in business time.

## Tech stack

| Part | Technology |
| --- | --- |
| Backend | Python, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL 17 (Docker for local development) |
| Frontend | React, TypeScript, Vite, React Router |
| Tests | pytest (backend), Vitest and Testing Library (frontend) |
| Quality | oxlint with `jsx-a11y` rules, `tsc` type checking |

## Getting started

### What you need

- Python 3.12
- A recent Node.js LTS release
- Docker (for the database)

### 1. Get the code and configure it

```bash
git clone https://github.com/hal-imaxabdi/slotwise.git
cd slotwise
cp .env.example .env
```

Open `.env` and set the values. `.env.example` lists every setting. The `.env` file is never committed.

### 2. Start the database

From the repository root:

```bash
docker compose up -d
docker compose ps
```

### 3. Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload
```

The API runs at http://127.0.0.1:8000.

### 4. Start the frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Use `localhost`, not `127.0.0.1`, because the backend only accepts the origins listed in `ALLOWED_ORIGINS`.

### Signing in

After seeding, a demo customer exists:

```
demo.customer@example.com
demo-customer-2026
```

This account is for local development only. Staff and admin accounts are created from the command line. The password is always asked for interactively and is never passed as an argument:

```bash
cd backend
python -m scripts.create_user --email jane@example.com --name "Jane Doe" --role staff
python -m scripts.create_user --email root@example.com --name "Root Admin" --role admin
```

## Running the tests

Backend (the database container must be running; the tests use a separate `*_test` database):

```bash
cd backend
../backend/.venv/bin/pytest
```

Frontend:

```bash
cd frontend
npx tsc -b        # Vitest does not type-check, so run this too
npm run lint
npm test
```

## Project structure

```
slotwise/
├── backend/
│   ├── app/            FastAPI app: routers, booking and slot logic, models, auth
│   ├── migrations/     Alembic migrations
│   ├── scripts/        seed data, create users, purge old data
│   └── tests/          pytest suite
├── frontend/
│   └── src/
│       ├── api/        typed API client, error handling, one function per endpoint
│       ├── auth/       auth provider and route guards
│       ├── components/ shared and role-specific components
│       ├── hooks/      data hooks
│       ├── lib/        date, format and closure helpers
│       ├── pages/      one component per route
│       └── styles/     design system (tokens, base, components, layout, screens)
├── docs/               database diagram (erd.md) and operations notes (operations.md)
└── docker-compose.yml  local PostgreSQL
```

## Routes

| Route | Access |
| --- | --- |
| `/login` | public |
| `/services`, `/services/:serviceId/book`, `/appointments` | signed in |
| `/staff`, `/staff/unavailable-periods` | staff or admin |
| `/admin`, `/admin/business-hours` | admin |

## Security

- The session is an HttpOnly cookie. The CSRF token is kept in memory and sent as `X-CSRF-Token` on every non-GET request.
- Roles are checked on the server for every request. The frontend route guards only decide what to show.
- Passwords are hashed, and sign-in attempts are throttled.
- Allowed browser origins are set with `ALLOWED_ORIGINS`.
- In development the Vite server proxies `/api` to the backend, so the browser sees one origin.

## Frontend notes

**Design system.** Colours, type sizes, spacing, radii and shadows are CSS variables in `frontend/src/styles/tokens.css`. A plain `<button>` is the secondary style, and classes such as `btn--primary` and `btn--danger` add variants. Messages use `alert alert--error|success|warning|info`, and statuses use `status-pill`. There is no UI library and no web font.

**Accessibility.**

- A skip link and a focusable `<main>`. The document title follows the route.
- Opening a confirmation, edit or reschedule panel moves focus into it. Closing returns focus to the button that opened it.
- Status and error messages use `role="status"` and `role="alert"`.
- Visible keyboard focus on every control, and colour pairs chosen to meet WCAG AA contrast.
- Layouts adapt from desktop to mobile widths.

## More documentation

- [`docs/erd.md`](docs/erd.md): database structure
- [`docs/operations.md`](docs/operations.md): operating and maintenance notes


