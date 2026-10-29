# Slotwise

Appointment booking for small businesses. Customers browse services, pick a free time slot, and book, cancel or reschedule. Staff manage appointments and closures. Admins also manage services and business hours.

- Backend: FastAPI, SQLAlchemy, PostgreSQL 17, Alembic (`backend/`)
- Frontend: Vite, React, TypeScript (`frontend/`)
- Business timezone: Asia/Jakarta. Times are stored in UTC and booked in 30-minute steps.
- More detail: `docs/erd.md` and `docs/operations.md`

## Run locally

Settings are read from the repo-root `.env` (never committed; `.env.example` shows the keys).

Terminal A, repo root (database):

```bash
docker compose up -d
docker compose ps
```

Terminal B, backend (the prompt must start with `(.venv)`):

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload
```

Terminal C, frontend:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (use `localhost`, not `127.0.0.1`).

### Logging in

Demo customer after seeding: `demo.customer@example.com` / `demo-customer-2026`.

Staff and admin accounts are created from the command line (the password is always prompted, never passed as an argument). Run from `backend/` with the venv active:

```bash
python -m scripts.create_user --email jane@example.com --name "Jane Doe" --role staff
python -m scripts.create_user --email root@example.com --name "Root Admin" --role admin
```

## Features by role

| Role | Pages |
| --- | --- |
| Customer | Services, booking a slot, My appointments (cancel, reschedule) |
| Staff | Staff page (filter and page through all appointments, cancel, reschedule, book on behalf of a customer via the customer picker), Closures (add and remove unavailable periods that block slots) |
| Admin | Everything staff can do, plus Admin (create, edit and deactivate services) and Business hours (per-day opening hours, each day saved on its own) |

## Frontend

Stack: Vite, React, TypeScript, react-router (import from `react-router`), Vitest with Testing Library, oxlint (with `jsx-a11y`).

### Layout

| Path | Purpose |
| --- | --- |
| `src/api/` | Typed client, error classes (`ApiError`), error descriptions, one function per endpoint |
| `src/auth/` | Auth provider, `useAuth`, `RequireAuth` and `RequireRole` route guards |
| `src/components/` | `AppLayout`, `SlotPicker`, `RescheduleForm`, `StaffAppointmentList`, `StaffBookingForm`, `CustomerPicker`, `ClosureForm`, `ClosureList`, `BusinessHoursDayEditor`, `AdminServiceForm`, `AdminServiceList` |
| `src/hooks/` | Data hooks: `useServices`, `useMyAppointments`, `useStaffAppointments`, `useUnavailablePeriods`, `useAdminServices`, `useBusinessHours` |
| `src/lib/` | Date, format, weekday and closure helpers (all business times use Asia/Jakarta) |
| `src/pages/` | Login, Services, Booking, Appointments, Staff, Closures, Admin, BusinessHours |

### Routes

| Route | Access |
| --- | --- |
| `/login` | public |
| `/services`, `/services/:serviceId/book`, `/appointments` | signed in |
| `/staff`, `/staff/unavailable-periods` | staff or admin |
| `/admin`, `/admin/business-hours` | admin |

### How it talks to the API

- The dev server proxies `/api` to `http://127.0.0.1:8000` and strips the prefix, so the browser sees one origin and no CORS is needed.
- The port is fixed (`strictPort`) because the backend only accepts origins listed in `ALLOWED_ORIGINS`.
- The session is an HttpOnly cookie. The CSRF token is kept in memory and sent as `X-CSRF-Token` on every non-GET request.

### Checks

Run from `frontend/`:

```bash
npx tsc -b        # Vitest does not type-check, so run this too
npm run lint
npm test
```

Backend tests: from `backend/` with the venv active, `pytest`.

### Accessibility notes

- Skip link and a focusable `<main>`; the document title follows the route.
- Opening a confirmation, edit or reschedule panel moves focus into it. Closing returns focus to the button that opened it. After a finished action focus goes to the page or section heading.
- Status and error messages use `role="status"` and `role="alert"`.
- Controls are real buttons, inputs and links with accessible names. `jsx-a11y` lint rules run with `npm run lint`.
- A global `:focus-visible` ring (2px blue) shows keyboard focus. Elements focused only by code (`tabindex="-1"`: `<main>`, headings) show no ring.
- Disabled buttons and `aria-disabled` elements are dimmed with a `not-allowed` cursor.
- The header and nav wrap on narrow screens so nothing overflows.
- Slot button borders and hint text meet WCAG contrast for UI components and text.
