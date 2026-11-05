<div align="center">

<img src="docs/logo.svg" width="64" height="64" alt="Slotwise logo">

# Slotwise

**Online booking for barbershops, salons and studios.**<br>
Fully booked. Never double-booked.

[**Live demo**](https://slotwise-mocha.vercel.app) · [Report an issue](https://github.com/hal-imaxabdi/slotwise/issues)

![React](https://img.shields.io/badge/React_19-0b0b0b?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-0b0b0b?style=flat-square&logo=typescript&logoColor=3178C6)
![three.js](https://img.shields.io/badge/three.js_+_R3F-0b0b0b?style=flat-square&logo=threedotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0b0b0b?style=flat-square&logo=fastapi&logoColor=009688)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-0b0b0b?style=flat-square&logo=postgresql&logoColor=4169E1)

<!-- Screenshot: landing page hero, 1440 wide (docs/images/landing.jpg) -->
<img src="docs/images/landing.jpg" alt="The Slotwise landing page" width="900">

</div>

## What it is

Slotwise is booking software for small shops that work by appointment. Clients book a time
that is genuinely free from their phone, the team works from one shared day, and no two
clients are ever given the same slot, even when they press Book at the same moment.

## Live demo

The [live demo](https://slotwise-mocha.vercel.app) is a fictional Jakarta barbershop with a
full week of bookings. One click signs you in; no account is needed.

| Role | What you can try |
|---|---|
| **Client** | Browse services with prices and lengths, book a free time, move or cancel it up to 24 hours before. |
| **Staff** | The day-book by date and status, walk-ins booked on a client's behalf, visits marked done or no-show, closures for training. |
| **Owner** | Everything staff can do, plus adding, pricing and pausing services and setting the weekly opening hours. |

> [!NOTE]
> Demo data resets regularly. The server sleeps when idle, so the first visit can take up to a minute to wake it.

<table>
  <tr>
    <!-- Screenshots: services, booking and staff screens, 1440 wide (docs/images/*.jpg) -->
    <td width="33%"><img src="docs/images/services.jpg" alt="Services"><br><sub><b>Services</b></sub></td>
    <td width="33%"><img src="docs/images/booking.jpg" alt="Booking a time"><br><sub><b>Booking</b></sub></td>
    <td width="33%"><img src="docs/images/staff.jpg" alt="The staff day-book"><br><sub><b>Staff day-book</b></sub></td>
  </tr>
</table>

## Features

- **No double bookings.** Overlapping appointments are rejected by PostgreSQL itself, so the guarantee holds under simultaneous requests.
- **Only real availability.** Free times come from opening hours, lunch breaks, closures and existing bookings.
- **Self-service for clients.** Book, reschedule or cancel online, and delete the account at any time.
- **Built for the counter.** Staff see the whole day at a glance and handle walk-ins and visit outcomes in a click.
- **Owner controls.** Services, prices and weekly hours change without disturbing bookings already made.
- **Secure by default.** Server-side sessions, CSRF tokens, origin checks, login throttling and argon2 password hashing.
- **Accessible.** Keyboard support, visible focus, WCAG AA contrast and reduced-motion handling.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, Motion, three.js with React Three Fiber, plain CSS with design tokens |
| Backend | FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| Testing | pytest, Vitest, Testing Library |
| Hosting | Vercel (frontend), Render (API and database) |

## Project structure

```
backend/    API, database migrations, seed and demo scripts, tests
frontend/   Web app, landing page and tests
docs/       Design system, data model and operations notes
```

## Running locally

Requires Python 3.12, Node.js 20.19+ and Docker. Copy `.env.example` to `.env` first.

```bash
docker compose up -d db
cd backend && pip install -r requirements.txt && alembic upgrade head
DEMO_MODE=true python -m scripts.reset_demo && DEMO_MODE=true uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

Deployment settings and the demo reset are described in [docs/operations.md](docs/operations.md),
and the visual system in [docs/DESIGN.md](docs/DESIGN.md).
