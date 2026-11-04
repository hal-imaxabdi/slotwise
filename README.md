<div align="center">

<img src="docs/logo.svg" width="72" height="72" alt="Slotwise logo">

# Slotwise

**Appointment booking for barbershops, salons and studios.**<br>
Fully booked. Never double-booked.

<br>

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

<br>

[![Live demo](https://img.shields.io/badge/Live_demo-24392D?style=for-the-badge)](https://slotwise-mocha.vercel.app)

<br><br>

<img src="docs/images/landing.jpg" alt="Slotwise landing page" width="900">

</div>

<br>

## Overview

Slotwise is a full-stack booking platform for small appointment-based businesses. Clients book
from their phone in under a minute, and the whole team works from one shared calendar. Every
booking is checked by the database itself, so two clients can never be given the same time slot.

## Live demo

**Try the live demo** to sign in instantly; no account is needed.
<table>
  <tr>
    <td width="33%"><img src="docs/images/services.jpg" alt="Services"><br><sub><b>Services</b></sub></td>
    <td width="33%"><img src="docs/images/booking.jpg" alt="Booking a time"><br><sub><b>Booking</b></sub></td>
    <td width="33%"><img src="docs/images/staff.jpg" alt="Staff appointments"><br><sub><b>Staff view</b></sub></td>
  </tr>
</table>

> [!NOTE]
> Demo data resets regularly. The server sleeps when idle, so the first request may take up to a minute.

## Key features

- **Conflict-free scheduling.** Overlapping bookings are rejected at the database level, even under simultaneous requests.
- **Live availability.** Only genuinely free slots are offered, based on opening hours, closures and existing bookings.
- **Self-service for clients.** Bookings can be rescheduled or cancelled online up to 24 hours in advance.
- **Tools for the team.** Staff handle walk-ins and visit outcomes; owners manage services, pricing and hours without disrupting existing bookings.
- **Secure by default.** Server-side sessions, hashed passwords, CSRF protection and login throttling. Clients can delete their account at any time.
- **Responsive and accessible.** Built mobile-first, with keyboard support and reduced-motion handling.

## Getting started

**Prerequisites:** Python 3.12, Node.js 20.19+ and Docker. Copy `.env.example` to `.env` and set the
database credentials.

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

## Project structure

```
backend/    FastAPI application, database migrations and tests
frontend/   React web application and tests
docs/       Design system, data model and operations notes
```


