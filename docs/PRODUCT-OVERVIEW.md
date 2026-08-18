# Merali Lettings — Product Overview

A property-management platform for a UK lettings agency. It is the day-to-day
operating system for the team: the record of every property, landlord, tenant and
tenancy, the money in and out, and the compliance, keys and maintenance around them.

This document explains what the app is and what each part does. It is a functional
overview, not a technical manual.

---

## 1. At a glance

- **Who it's for:** the internal Merali Lettings team (staff log in; there is no
  public/tenant-facing side today).
- **What it replaces:** spreadsheets and scattered documents for properties,
  tenancies, rent tracking, bank reconciliation, keys, certificates and reminders.
- **Shape of the app:** a left sidebar of modules; each module is a searchable,
  filterable list; creating or editing a record opens a **right-hand drawer** form.
- **Look & feel:** a warm "espresso + champagne-gold" theme, light and dark aware.
- **Access:** everything is gated by **roles and permissions** — a person only sees
  the modules and actions their role allows.

---

## 2. Technology (one paragraph)

Built on **Next.js** (App Router, React, TypeScript) with **Tailwind** for styling,
and **Supabase** (PostgreSQL, Auth, Storage) as the backend. Bank feeds use
**Plaid** (currently in sandbox); address lookup uses **Google Places**. Sensitive
fields (bank details, tenant identity data) are **encrypted at the application layer**
on top of Supabase's own at-rest encryption. Deployed on **Vercel** (a push to the
main branch auto-deploys).

---

## 3. Navigation & modules

The sidebar is grouped into four sections.

### Main

| Module | What it does |
|---|---|
| **Dashboard** | The landing page. Headline counts, an arrears/overdue summary, unprotected-deposit alerts, upcoming reminders, tenancy renewals this month, and recent activity. |
| **Properties** | The portfolio. A real **Building → Sub-building → Unit** hierarchy: a building contains sub-buildings and units, each drillable to its own detail page with a breadcrumb and a "Contents" panel. Container properties roll up their units' occupancy and finances. Each property holds address, ownership, title documents (tenure), utilities, photos, and links to its landlord, tenancies, keys, maintenance and certificates. |
| **Tenants** | People (or companies) who rent. Personal and contact details, a unified **Contacts** tab (emergency contacts and guarantors, each typed), and a per-tenant view of their tenancies and arrears. Company tenants capture a company address. Identity/PII fields are encrypted. |
| **Landlords** | Property owners. Individual, company or trust; multiple people (directors/trustees/contacts) per landlord; bank details (encrypted); internal code and Active/Dormant status. |
| **Tenancies** | The lets themselves (formerly "leases"). See section 4 — this is the core workflow. |
| **Payments** | The rent schedule across all tenancies — what's expected, collected and overdue — with mark-paid / mark-unpaid controls. |

### Operations

| Module | What it does |
|---|---|
| **Maintenance** | Repair/works jobs, grouped by status, with urgency, type, linked property/supplier and comments. |
| **Finances** | The overall income/expense ledger — every transaction with VAT, category and nominal code. |
| **Nominal** | The chart of accounts (nominal codes) and the transaction manager: add income/expenses, tag them to a property/tenancy/nominal, export to CSV. |
| **Unreconciled** | A review queue of imported bank transactions awaiting a human. Approve (assign property/tenancy/nominal), match to a rent instalment, or dismiss. See section 5. |
| **Keys** | A key tracker: one row per key code, with copies, a movement log (issued/returned), spares and lost-key status. |
| **Suppliers** | Contractors and service providers used by maintenance. |
| **Staff/Team** | Team members and their roles. |

### Compliance & Docs

| Module | What it does |
|---|---|
| **Certifications** | Compliance certificates (gas, electrical, etc.) per property, with expiry tracking (Valid / Expiring / Expired) and bulk add. |
| **Reminders** | Task/alert reminders with assignees and alert dates; feeds the dashboard's "upcoming reminders". |
| **Reports** | A custom report builder — pick a data source, choose columns/filters, run it, export CSV, and save templates. |
| **Logs** | An activity log of who did what across the system. |

### Account

| Module | What it does |
|---|---|
| **Roles** | Role definitions and the permission matrix (per-module view/create/edit/delete). |
| **Settings** | Option sets (the dropdown values used across forms), notification preferences and admin configuration. |

There is also a **command palette** and global search for jumping between records
quickly, and a **notifications** area.

---

## 4. The core workflow — a tenancy

The tenancy (lease) is the heart of the app and ties properties, tenants and money
together.

- **Setup:** a tenancy links a **property** to **one or more tenants** (a lead tenant
  plus co-tenants). It records the **term** (Fixed or Variable), **tenancy start/end**,
  a distinct **tenancy commencement** and **rent commencement** date, the tenancy type
  (e.g. AST) and a free-text internal tenancy code.
- **Rent & schedule:** you set the rent and a **payment schedule** — in advance or in
  arrears; monthly, quarterly (English quarter days or calendar), weekly (with a due
  day) or custom due dates. The app shows a live worked-example preview and then
  generates the **rent schedule** (the list of dated instalments) automatically.
- **Rent reviews:** future rent increases are entered up-front with their effective
  dates and flow into the schedule automatically.
- **Deposit:** amount + scheme (including "Landlord held") + a "Deposit received" toggle.
- **Status:** each tenancy is automatically **Current / Past / Future**, derived from
  its dates — no manual status-keeping.
- **Balance:** each tenancy shows a headline **Balance**, auto-calculated from the rent
  schedule **and** the finances linked to it (rent outstanding + charges − payments),
  telling you at a glance whether the tenant is in arrears or in credit.
- **Ledger:** a per-tenancy ledger lists every transaction tagged to it, alongside the
  rent schedule.

---

## 5. The money flow — finance & reconciliation

- **Transactions** (income/expense) are recorded with net/VAT/gross, a category and a
  **nominal code**, and can be tagged to a property and a tenancy.
- **Bank feeds:** transactions can be imported from the bank (via Plaid). On import,
  confident, unambiguous rent payments are **auto-matched** to the right rent
  instalment; anything uncertain drops into the **Unreconciled** queue.
- **Unreconciled queue:** staff review each imported line and either **Approve** it
  (assign property/tenancy/nominal — with auto-assignment by property code where
  possible), **Match to rent** (reconcile it against a specific instalment), or
  **Dismiss** it.
- **Matching:** the match screen suggests the best-fitting instalments (scored on
  amount, date and the bank reference — a mention of the property code or tenant
  surname boosts the match) and lets you **search and pick any instalment manually**
  if the suggestions are wrong.
- **Part-payments:** a match records the **actual** amount received — marking the
  instalment **Partial** (with the remainder still owed) or **Paid** — rather than
  assuming full payment.
- **Undo:** a reconciliation can be **unmatched**, returning the transaction to the
  queue and recalculating the instalment; expenses can never be matched to rent.

---

## 6. Cross-cutting features

- **Roles & permissions** — every module and action is permission-gated; roles are
  configurable in the Roles module.
- **Right-hand drawers** — all create/edit forms open as side drawers, keeping you in
  context on the list behind them.
- **Search & filters** — every list has a name/keyword search plus inline dropdown
  filters (status, type, property, etc.).
- **Clickable rows** — clicking a row opens the most useful action (detail page or edit
  drawer) for that record.
- **Reminders & notifications** — scheduled reminders and in-app notifications for
  renewals, arrears, certificate expiry and ending tenancies.
- **Reporting & export** — the custom report builder plus CSV export from finance lists.
- **Activity log** — an audit trail of changes.
- **Data protection** — field-level encryption (AES-256-GCM) for bank details and
  tenant identity data, on top of transport (TLS) and at-rest encryption.

---

## 7. Integrations & environment

- **Supabase** — database, authentication and file storage.
- **Plaid** — bank-account linking and transaction import (currently **sandbox**;
  production access is a go-live prerequisite).
- **Google Places** — address autocomplete on property/tenant/landlord forms.
- **Vercel** — hosting and continuous deployment.

---

## 8. Known gaps / roadmap (as of this document)

- **Tenancy application intake** — the three client application forms (Residential,
  Student, Commercial) are not yet built into the platform; a future "Applications"
  stage would capture prospective tenants and convert an approved application into a
  tenancy.
- **Go-live prerequisites** — Plaid production access, outbound email/SMTP for
  password-reset and notifications, a custom domain, and loading the real portfolio in
  place of the current demo data.

---

*This overview reflects the app as built to date. Modules and workflows may evolve; the
sidebar in the running app is always the source of truth for what's available.*
