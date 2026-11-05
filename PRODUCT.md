# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary (landing page):** owners of small appointment-based shops (barbershops, salons, studios) deciding whether Slotwise could run their bookings. They are busy, often reading on a phone between clients, and judge by whether the product looks like it would actually hold up on a full Saturday.
- **Clients** of those shops: book, reschedule or cancel a visit from their phone in under a minute.
- **Staff:** work from the day's book at the counter. They see who is next, book walk-ins and mark visits completed or no-show.
- **Owners/admins:** manage services and prices, weekly opening hours and closures.
- Secondary: technical visitors (the project is a public portfolio piece with an open GitHub repo).

## Product Purpose

Slotwise is online booking for small appointment-based businesses. Clients book only times that are genuinely free; the whole team works from one shared book. Success: an owner trusts it with a full day, and a client books without phoning.

## Positioning

The no-double-booking guarantee is enforced by the database itself (a Postgres exclusion constraint), not by app logic that can race. Two clients can never be given the same slot, even when they press "Book" at the same moment. Availability is computed from opening hours, closures and existing bookings, so only real slots are ever offered.

## Operating Context

- Public live demo with three one-click roles (client, staff, owner) on a fictional shop whose data resets regularly. The API runs on a free host that sleeps, so the first request can take up to a minute.
- Time zone and currency of the demo shop: Asia/Jakarta, IDR.
- Clients may move or cancel up to 24 hours before a visit.

## Capabilities and Constraints

- Roles: customer, staff, admin. Routes: services, booking, my appointments, account, staff day-book, closures, admin services, business hours.
- Stack is fixed: React 19 + Vite + TypeScript with plain CSS and tokens (frontend, Vercel); FastAPI + Postgres (backend, Render).
- Security behaviour (session cookies, in-memory CSRF token, origin check, login throttling, argon2) is part of the product and must not change for design reasons.
- No pricing plans, sign-up funnel for shops, or multi-location support exist. Do not imply them.

## Brand Commitments

- Name: **Slotwise**. Everything else (logo, palette, type) is open to replacement.
- Real salon/barbershop photography stays in the product, but it supports the story; it must not be the lead of the page.
- The owner dislikes the previous direction for being quiet and sleepy, template-like, photo-led, and for bland app screens.

## Evidence on Hand

- Working live demo (https://slotwise-mocha.vercel.app) and open source repo (https://github.com/hal-imaxabdi/slotwise).
- Real photos in `frontend/public/images` (Pexels/Unsplash, free licence).
- Generated demo data: 8 active services, 18 customers, about 150 appointments.
- No real customers, testimonials, usage numbers or press exist. Never fabricate them.

## Product Principles

1. Show the book working, not a mood: the product's mechanism (free slots, a taken slot refusing a second booking) is the proof.
2. One glance at the counter: staff screens are read in seconds, mid-conversation.
3. Honest by construction: only real slots, real facts, labelled demo data.
4. A busy shop is the normal case: design for a full day, not an empty one.

## Accessibility & Inclusion

WCAG 2.1 AA contrast, visible focus rings, keyboard operation, 44px touch targets on phones, and full `prefers-reduced-motion` support. Existing a11y tests must keep passing.
