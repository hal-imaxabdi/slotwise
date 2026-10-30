# 📅 Slotwise – Appointment Booking System

A modern, full-stack appointment booking platform built with React, FastAPI, and PostgreSQL. Features include customer authentication, service browsing, appointment scheduling, and dedicated staff and admin management.

#### [Features](#features) • [Getting Started](#getting-started) • [Tech Stack](#tech-stack) • [Preview](#preview)

---

## Features

- Customer registration and secure authentication
- Browse available services and appointment slots
- Book, cancel, and reschedule appointments
- Staff dashboard for managing appointments and customers
- Admin management of services and business hours
- Unavailable period and schedule management
- CSRF protection and origin validation

## Getting Started

### Installation

1. **Clone this repository**

   ```bash
   git clone https://github.com/hal-imaxabdi/slotwise.git
   cd slotwise
   ```

2. **Configure the database**

   Create a `.env` file with the required environment variables and database credentials, then start PostgreSQL:

   ```bash
   docker compose up -d db
   ```

3. **Start the backend**

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --reload
   ```

4. **Start the frontend**

   Open another terminal:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## ⚙️ Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **Database:** PostgreSQL
- **ORM:** SQLAlchemy
- **Database Migrations:** Alembic
- **Testing:** Pytest
- **Containerization:** Docker Compose

## 📷 Preview

### Login Page

![Slotwise login Page](docs/login.png)

### Customer Registration

![Slotwise Registration](docs/register.png)

### Customer Dashboard

![Slotwise Customer Dashboard](docs/customer-dashboard.png)

### Appointment Booking

![Slotwise Appointment Booking](docs/booking.png)

### Staff Dashboard

![Slotwise Staff Dashboard](docs/staff.png)

### Admin Dashboard

![Slotwise Admin Dashboard](docs/admin.png)

---

