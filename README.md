<div align="center">

# 💳 Payment Management System

**A full-stack web app for managing full & installment payments across multiple campaigns — with role-based access, an installment-scheduling engine, online card payments (Epoint), no-login customer payment links, and a tri-lingual UI.**

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![Status](https://img.shields.io/badge/status-active-success)

</div>

---

## Overview

A system built for a multi-campaign education business to replace manual/spreadsheet payment
tracking. A **Super Admin** manages managers, campaigns, and pricing and sees everything; each
**Manager** works only within the campaigns assigned to them. Customers pick a payment plan (full or
2–5 installments) at registration, and the app tracks total, paid, and remaining amounts, generates
a per-installment deadline schedule, and surfaces overdue balances at a glance.

Payments can be taken **in person (cash)** or **online by card via the Epoint gateway**, and every
customer gets a **shareable, no-login payment link** so they can pay from home. The whole interface
is available in **Azerbaijani, English, and Russian**.

> The frontend and REST API are served by the **same Express server on a single port** — no separate
> build step, no CORS wiring, easy to deploy behind one reverse-proxied subdomain.

---

## Screenshots

> _Add screenshots here once deployed (login, dashboard, customer detail, customer payment page)._

<!--
![Dashboard](docs/screenshots/dashboard.png)
![Customers](docs/screenshots/customers.png)
![Customer detail](docs/screenshots/customer.png)
![Payment page](docs/screenshots/pay.png)
-->

---

## Features

### 👥 Roles & access control
- **Super Admin** — create/edit/delete managers, assign them to campaigns; create/edit/delete
  campaigns (price + max installments 1–5); view all payments, statistics, and collections.
- **Manager** — scoped to their assigned campaigns only; add customers, record payments, view
  customer details and per-campaign stats.
- Access is enforced **server-side** on every read and write, not just hidden in the UI.

### 💰 Payments & installments
- Customer picks a plan once (full, or 2–5 installments capped by the campaign max).
- The app suggests an installment amount (e.g. `500 / 3 = 166.67 AZN`); each payment can be any
  amount up to the remaining debt; status flips to **Paid** automatically at zero balance.
- Payments recorded as **cash** or **online (Epoint)**; only verified online payments update balances.

### 📅 Scheduling & deadline tracking
- Setting a **final deadline** when adding a customer auto-generates an **installment schedule**
  (evenly spread to the deadline, or monthly if none is set); each installment's due date is editable.
- The **Customers** list shows each customer's **next payment date** with a colour-coded badge
  (*N days left* / *due today* / *overdue*) next to a paid/remaining progress bar.
- The dashboard shows an **Overdue Customers** count; customers see their next due amount and date too.
- The customer list is **sortable** by any column (name, campaign, totals, progress, next payment, status).

### 🔗 Customer self-service payment links
- Each customer has a **stateless, signed, no-login link** (`/pay.html?token=…`) a manager copies and
  sends by SMS/WhatsApp/email; the customer views their balance and pays online from home.
- Configurable per link: a **message** to the customer, a **minimum payment** (defaults to the
  suggested installment, auto-capped at remaining debt), and **cancel/reactivate**.
- Self-service payments are **credited to the manager whose link the customer used**.
- A link stays valid until the customer is **fully paid** or the manager **cancels** it.

### 📊 Statistics & exports
- Dashboards for total revenue, outstanding debt, paid vs. debtor customers, collections by
  campaign and by manager, and a revenue-over-time chart (daily/weekly/monthly/yearly).
- **Excel** (ExcelJS) and **PDF** (PDFKit) export that respect the active filters.

### 🌐 Internationalization
- Full UI in **Azerbaijani (default), English, and Russian** with a live EN/AZ/RU switcher; the
  choice is remembered per browser, with locale-aware date and number formatting.

---

## Tech stack

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | Vanilla **HTML + CSS + JavaScript** (no framework, no build step) |
| Backend    | **Node.js**, **Express**, **TypeScript**                          |
| Database   | **PostgreSQL** with **Prisma ORM**                                |
| Auth       | **JWT** (role-based; token in `localStorage`)                     |
| Payments   | **Epoint** gateway (epoint.az) + built-in sandbox                 |
| Exports    | **ExcelJS** (xlsx), **PDFKit** (pdf)                              |

---

## Project structure

```
/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   ├── seed.ts              # Demo data seeder
│   │   └── migrations/          # Prisma migrations
│   ├── src/
│   │   ├── controllers/         # Route handlers (auth, customers, payments, stats, export…)
│   │   ├── routes/              # Express routers
│   │   ├── middleware/auth.ts   # JWT auth + role guards
│   │   ├── lib/                 # Prisma client, payment/schedule/token helpers, Epoint adapter
│   │   ├── config.ts
│   │   └── index.ts             # Server entry (serves /public + /api on one port)
│   ├── public/                  # Frontend (HTML/CSS/JS) served statically
│   │   ├── css/  js/  *.html
│   └── package.json
└── README.md
```

---

## Getting started

### Prerequisites
- **Node.js 20+** and **PostgreSQL 14+**

### 1. Clone & install

```bash
git clone <repo-url>
cd "Payment Management System/backend"
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

| Variable            | Description                                                    |
| ------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string                                  |
| `JWT_SECRET`        | Secret used to sign JWTs (use a long random string)           |
| `JWT_EXPIRES_IN`    | Token lifetime (default `7d`)                                 |
| `PORT`              | Server port (default `3000`)                                  |
| `APP_BASE_URL`      | Public base URL of the app (e.g. `http://localhost:3000`)     |
| `EPOINT_MODE`       | `sandbox` (default) or `live`                                 |
| `EPOINT_PUBLIC_KEY` | Epoint merchant public key (live mode)                        |
| `EPOINT_PRIVATE_KEY`| Epoint merchant private key (live mode)                       |
| `EPOINT_BASE_URL`   | Epoint API base (`https://epoint.az/api/1`)                   |
| `EPOINT_CURRENCY`   | Currency code (default `AZN`)                                 |

Example `DATABASE_URL`:

```
postgresql://postgres:postgres@localhost:5432/payment_management?schema=public
```

### 3. Set up the database

```bash
npx prisma migrate deploy   # apply existing migrations
npm run seed                # optional: load demo data + demo accounts
```

### 4. Run

```bash
npm run dev                 # hot-reload dev server
```

Open **http://localhost:3000** — sign in with a demo account or the one-click demo buttons.

> ⚠️ Open the app via `http://localhost:3000`, **not** by opening the `.html` files from disk — the
> API calls only work when served by the backend.

---

## Demo accounts (from the seed script)

| Role        | Email               | Password |
| ----------- | ------------------- | -------- |
| Super Admin | admin@system.com    | admin123 |
| Manager     | manager1@system.com | manager1 |
| Manager     | manager2@system.com | manager2 |

The seed also creates 3 campaigns and 15 customers with varied plans, statuses, and payment history.

---

## Scripts (in `backend/`)

| Script                    | Description                          |
| ------------------------- | ------------------------------------ |
| `npm run dev`             | Start the server with hot reload     |
| `npm run build`           | Compile TypeScript to `dist/`        |
| `npm start`               | Run the compiled server (production) |
| `npm run seed`            | Seed the database with demo data     |
| `npm run prisma:generate` | Generate the Prisma client           |
| `npm run prisma:migrate`  | Create a dev migration               |
| `npm run prisma:deploy`   | Apply migrations (production)        |

---

## API overview

All endpoints are under `/api`. Every route except `/api/auth/*`, `/api/pay/*`, and `/api/epay/*`
requires an `Authorization: Bearer <token>` header.

- **Auth:** `POST /auth/login`, `POST /auth/logout`
- **Managers** (Super Admin): `GET/POST /managers`, `PUT/DELETE /managers/:id`
- **Campaigns:** `GET/POST /campaigns`, `PUT/DELETE /campaigns/:id`, `POST /campaigns/:id/assign-manager`
- **Customers:** `GET/POST /customers`, `GET/PUT /customers/:id`, `PUT /customers/:id/schedule`
- **Payments:** `GET/POST /customers/:id/payments`, `POST /customers/:id/payments/epay`
- **Statistics:** `GET /stats/overview`, `/stats/by-campaign`, `/stats/by-manager`, `/stats/timeline?period=daily|weekly|monthly|yearly`
- **Exports:** `GET /export/excel`, `GET /export/pdf` (filters: `campaign`, `manager`, `status`, `dateFrom`, `dateTo`)
- **Public (no auth):** `GET /pay/:token`, `POST /pay/:token/epay` (customer portal); `POST /epay/epoint-callback` (Epoint result URL)

---

## Online payments (Epoint)

A built-in **sandbox** makes the full pay-online flow work out of the box with no credentials — a
simulated gateway page and a signed, **idempotent** callback that only settles a balance on verified
success.

**Going live with Epoint:** set the merchant keys and switch mode in `.env`:

```
APP_BASE_URL=https://payments.your-domain
EPOINT_MODE=live
EPOINT_PUBLIC_KEY=...
EPOINT_PRIVATE_KEY=...
```

Then set your Epoint dashboard **Result URL** to `<APP_BASE_URL>/api/epay/epoint-callback`. In live
mode the backend calls Epoint's `/api/1/request`, redirects the payer to Epoint's hosted page, and
settles the balance on the signed callback (signature = `base64(sha1(private_key + data + private_key))`).
The Epoint adapter lives in `backend/src/lib/epoint.ts`.

> The live Epoint path is written to Epoint's documented API but has **not** been exercised against a
> real merchant account — validate with Epoint **test** keys before production. The callback signature
> verification is unit-verified; the outbound create-payment call needs live/test keys to run.

---

## Deployment

The app is a single Node process serving both the UI and API, so hosting it (e.g. at a subdomain)
means running the server and reverse-proxying to it over HTTPS.

```bash
cd backend
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
npm start                    # run under pm2 / systemd / Docker on $PORT
```

- Put it behind **nginx or Caddy** with TLS (e.g. `payments.your-domain` → `localhost:3000`).
- Set `APP_BASE_URL` to the public HTTPS URL.
- Requires a **long-running Node runtime + PostgreSQL** — it can't run on static-only hosts.

### Production hardening
- Use a **strong random `JWT_SECRET`** and a **dedicated DB user/password** (not the dev defaults).
- Serve over **HTTPS** (auth token is stored client-side; Epoint requires HTTPS callbacks).
- For a clean production DB, skip the demo seed and create a real admin (edit `prisma/seed.ts`, or
  ask for a small create-admin script). Note: there is no in-app super-admin password change yet.

---

## License

Built as a client project. No license is granted by default (all rights reserved) — add a `LICENSE`
file if you intend to open-source it, or keep the repository private.
