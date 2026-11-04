<div align="center">

<img src="docs/logo.svg" width="64" height="64" alt="Slotwise logo">

# Slotwise

**Online booking for barbershops, salons and studios. Fully booked, never double-booked.**

### [→ Try the live demo](https://slotwise-mocha.vercel.app)

![React](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169e1?logo=postgresql&logoColor=white)

</div>

## About

Small appointment-based businesses often juggle bookings across phone calls, chat messages and a
paper diary, and two clients end up booked into the same chair. **Slotwise** replaces that with a
booking page clients can use in a minute on their phone, and one shared calendar the whole team
can trust.

It's a full-stack project I designed and built end to end: a React web app, a Python API and a
PostgreSQL database, all covered by automated tests and deployed online.

## Try it in one click

Open the [live demo](https://slotwise-mocha.vercel.app) and press **Try the live demo**. You're
signed in straight away to a fictional Jakarta barbershop with real-looking bookings. From the demo
section of the page you can also explore as a staff member or as the owner.

| Role | What to try |
|---|---|
| **Client** | Pick a service, choose a free time, book it, then reschedule or cancel it |
| **Staff** | See today's appointments, book a walk-in, mark a visit completed or no-show |
| **Owner** | Add or pause services, change prices, set opening hours and holiday closures |

> [!NOTE]
> The demo resets regularly, so change whatever you like. The server sleeps when idle on the free
> plan, so the very first click can take up to a minute.

## Features

- **No double bookings, ever.** The database itself refuses two bookings for the same time, even
  if two people tap "Book" at the same moment.
- **Real availability.** Clients only see times that are actually free, based on opening hours,
  closures and existing bookings.
- **Self-service changes.** Clients can move or cancel online up to 24 hours before.
- **Built for the team.** Staff can book walk-ins and track each visit. Owners control services,
  prices and hours, and Slotwise won't let a change strand someone who's already booked.
- **Secure accounts.** Proper sessions, hashed passwords, protection against cross-site attacks and
  login throttling. Clients can delete their account and data at any time.
- **Works on any screen.** Designed for phones first, keyboard friendly, and respectful of
  reduced-motion settings.

## Built with

| Part | Tools |
|---|---|
| Web app | React, TypeScript, Vite, Motion for animation, hand-written CSS |
| API | Python, FastAPI, SQLAlchemy |
| Database | PostgreSQL |
| Testing | Vitest and Testing Library (web app), Pytest (API) |
| Hosting | Vercel (web app) and Render (API and database) |

The visual design (colours, type, spacing and components) is documented in
[docs/DESIGN.md](docs/DESIGN.md), and the database design in [docs/erd.md](docs/erd.md).

## Run it locally

You'll need Python 3.12, Node.js 20.19+ and Docker.

```bash
git clone https://github.com/hal-imaxabdi/slotwise.git
cd slotwise
cp .env.example .env               # set a password and DATABASE_URL
docker compose up -d db            # start the database
```

Start the API (in `backend/`):

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
DEMO_MODE=true python -m scripts.reset_demo   # load the demo barbershop
DEMO_MODE=true uvicorn app.main:app --reload
```

Start the web app (in `frontend/`, in a second terminal):

```bash
npm install
npm run dev                        # open http://localhost:5173
```

The web app needs the API running, so keep both terminals open.

Run the tests:

```bash
cd backend && pytest
cd frontend && npm test
```

## Credits

Photos from [Pexels](https://www.pexels.com/license/) and [Unsplash](https://unsplash.com/license).
Font: Plus Jakarta Sans (SIL Open Font License). The barbershop and everyone in the demo are
fictional.
