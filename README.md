# Slotwise

Appointment booking for small businesses. Customers browse services, pick a free time slot, and book, cancel or reschedule. Staff and admins manage the calendar.

- Backend: FastAPI, PostgreSQL 17, Alembic (`backend/`)
- Frontend: Vite, React, TypeScript (`frontend/`)
- Business timezone: Asia/Jakarta. Times are stored in UTC and booked in 30-minute steps.
- More detail: `docs/erd.md` and `docs/operations.md`

## Run locally

Settings are read from the repo-root `.env`.

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

Open http://localhost:5173 (use `localhost`, not `127.0.0.1`). Demo customer after seeding: `demo.customer@example.com` / `demo-customer-2026`.

## Frontend

Stack: Vite, React, TypeScript, react-router (import from `react-router`), Vitest with Testing Library, oxlint.

### Layout

| Path | Purpose |
| --- | --- |
| `src/api/` | Typed client, error classes, one function per endpoint |
| `src/auth/` | Auth provider, `useAuth`, route guard |
| `src/components/` | App layout, slot picker, reschedule form |
| `src/hooks/` | Data hooks for services and my appointments |
| `src/lib/` | Date and formatting helpers (all business times use Asia/Jakarta) |
| `src/pages/` | Login, services, booking, my appointments |

### How it talks to the API

- The dev server proxies `/api` to `http://127.0.0.1:8000` and strips the prefix, so the browser sees one origin and no CORS is needed.
- The port is fixed (`strictPort`) because the backend only accepts origins listed in `ALLOWED_ORIGINS`.
- The session is an HttpOnly cookie. The CSRF token is kept in memory and sent as `X-CSRF-Token` on every non-GET request.

### Checks

Run from `frontend/`:

```bash
npx tsc -b
npm run lint
npm test
```

### Accessibility notes

- Skip link and a focusable `<main>`; the document title follows the route.
- Opening the cancel confirmation or reschedule panel moves focus into it. Closing returns focus to the button that opened it. After a finished action focus goes to the page heading.
- Status and error messages use `role="status"` and `role="alert"`.
- Interactive controls are real buttons, inputs and links with accessible names.