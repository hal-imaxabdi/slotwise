<div align="center">

<img src="docs/logo.svg" width="64" height="64" alt="Slotwise logo">

# Slotwise

Online booking for barbershops, salons and studios.

**[Live demo](https://slotwise-mocha.vercel.app)**

</div>

## About

Slotwise gives small appointment-based businesses a booking page clients can use from their phone,
and one shared calendar for the team. Two clients can't book the same time slot.

## Demo

Click **Try the live demo** on the site to sign in as a client. You can also sign in as staff or as
the owner from the demo section.

- **Client:** book a service, then reschedule or cancel it.
- **Staff:** view the day's appointments, book walk-ins, mark visits as completed or no-show.
- **Owner:** manage services, prices, opening hours and closures.

The demo data is fictional and resets regularly. The server sleeps when idle, so the first load can
take up to a minute.

## Features

- Only free time slots are shown, based on opening hours, closures and existing bookings
- Clients can reschedule or cancel up to 24 hours before
- Changes to hours can't affect bookings that already exist
- Clients can delete their account at any time
- Works on mobile and desktop

## Tech stack

React, TypeScript, FastAPI, PostgreSQL. Tested with Vitest and Pytest. Deployed on Vercel and Render.

## Running locally

Requires Python 3.12, Node.js 20.19+ and Docker. Copy `.env.example` to `.env` and fill it in, then:

```bash
docker compose up -d db

# API (backend/)
pip install -r requirements.txt
alembic upgrade head
DEMO_MODE=true python -m scripts.reset_demo
DEMO_MODE=true uvicorn app.main:app --reload

# Web app (frontend/)
npm install
npm run dev
```

## Credits

Photos from Pexels and Unsplash. The demo barbershop is fictional.
