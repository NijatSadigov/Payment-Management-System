# Case Study — Payment Management System

> A full-stack payment & installment-management platform for a multi-campaign education business
> (Hədəf Group, Azerbaijan). **This is a public demo/showcase build** — the production version
> delivered to the client is extended with additional company-specific features and integrations.

**Role:** Full-stack developer (design, backend, frontend, database, payment integration, i18n)
**Stack:** Node.js · Express · TypeScript · PostgreSQL · Prisma · Vanilla JS · Epoint · ExcelJS · PDFKit
**Type:** Client project (ongoing)

---

## Problem

An education company runs many paid courses ("campaigns") and lets students pay **in full or in
2–5 installments**. Payment tracking was manual and spreadsheet-driven, which caused real pain:

- **No single source of truth** — who paid how much, what's left, and when the next installment is due
  lived across scattered spreadsheets and people's heads.
- **No deadline visibility** — nobody could see, at a glance, which students were **overdue** or due soon.
- **No self-service** — every payment had to be collected in person or chased manually; there was no
  way for a student to just pay online from home.
- **No accountability** — with multiple managers per course, it was unclear **which manager** a payment
  should be credited to.
- **Manual reporting** — revenue, outstanding debt, and per-manager collections had to be tallied by hand.
- **Multi-language reality** — staff and students use **Azerbaijani, Russian, and English**.

## Solution

A single web application where a **Super Admin** manages managers, campaigns, and pricing, and each
**Manager** operates only within their assigned campaigns.

- **Installment plans & auto-tracking** — a student picks a plan once; the system tracks total, paid,
  and remaining, suggests the next installment, and flips the account to *Paid* automatically.
- **Scheduling & deadline tracking** — setting a final deadline generates an editable installment
  schedule. The main list shows each student's **next-payment date, days remaining, and overdue
  status** with colour-coded badges and progress bars; the dashboard surfaces an **overdue count**.
- **Online payments (Epoint)** — managers take card payments through the Epoint gateway. Built as a
  clean integration seam with a **sandbox** so the whole flow works with no credentials, and
  **cryptographically-signed, idempotent** callbacks so a balance only moves on a verified success.
- **No-login customer payment links** — each student gets a **signed, shareable link** to view their
  balance and pay online from home. The payment is **credited to the manager whose link was used**;
  links carry an optional message and minimum amount, and can be cancelled/reactivated.
- **Dashboards & exports** — revenue, outstanding debt, collections by campaign and by manager, a
  revenue-over-time chart, plus filtered **Excel and PDF** exports.
- **Tri-lingual UI** — every screen in **AZ / EN / RU** with a live switcher and locale-aware formatting.

## My role

I designed and built the whole application end to end:

- **Backend** — a TypeScript/Express REST API with **JWT auth and role-based access control** enforced
  server-side (managers are scoped to their campaigns on every query), Prisma models and migrations,
  and a statistics/reporting layer.
- **Payments** — the Epoint integration and the provider sandbox, the signed/idempotent callback
  handling, and the tokenized self-service payment portal with manager attribution.
- **Scheduling engine** — installment generation and the next-due / overdue computation that powers
  the deadline tracking.
- **Frontend** — a framework-free vanilla-JS app (shared component/utility layer, modals, toasts,
  charts, sortable/filterable tables) with a custom design system based on the client's brand.
- **Internationalization** — the EN/AZ/RU translation system and locale formatting.

## Outcome

A working, deployable platform that replaces manual spreadsheets with:

- One place to see every student's balance, plan, **next deadline, and overdue status**.
- **Online + in-person** payments with automatic balance updates and per-manager credit.
- **Self-service payment links** that let students pay from home with no account.
- One-click **revenue / debt / collections** reporting and **Excel/PDF** export.
- A **tri-lingual** interface matching how the staff and students actually work.

The public build demonstrates the core system and architecture; the production version delivered to
the client is tailored further with company-specific features.

---

## Technical highlights

- **Role-based security** enforced at the data layer, not just the UI.
- **Provider-agnostic payments with a sandbox** — the pay-online experience works with zero
  credentials; going live is a config switch, and callbacks are signature-verified and idempotent.
- **Stateless signed payment links** (HMAC tokens, no per-link storage) with manager attribution.
- **Custom installment-scheduling engine** (next-due amount/date, days-left, overdue).
- **From-scratch i18n** (EN/AZ/RU) with locale-aware dates and numbers.
- **No frontend framework** — a hand-built component/util layer keeps the client lightweight and
  dependency-free, served on the same origin as the API.
