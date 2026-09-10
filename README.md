<p align="center">
  <img src="./public/icon-512.png" width="130" height="130" alt="OES Icon" style="border-radius: 28px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.35);" />
</p>

<h1 align="center">OES — Overtime & Expense System</h1>

<p align="center">
  <strong>Next-Generation Enterprise Workforce Overtime Engine, Expense Reimbursement & Roster Automation Platform</strong>
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15.1.4-black?style=for-the-badge&logo=next.js" alt="Next.js 15" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" /></a>
  <a href="https://orm.drizzle.team"><img src="https://img.shields.io/badge/Drizzle_ORM-0.38-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black" alt="Drizzle ORM" /></a>
  <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-17-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://vitest.dev"><img src="https://img.shields.io/badge/Vitest-2.1-FCC72B?style=for-the-badge&logo=vitest&logoColor=black" alt="Vitest" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License: MIT" /></a>
</p>

---

## 🌟 Overview

**OES** is a mission-critical, enterprise-grade web application engineered to streamline workforce overtime calculation, claim verification, receipt image audits, and employee roster onboarding. Built on **Next.js 15 App Router**, **React 19**, **Better Auth**, and **Drizzle ORM**, OES delivers sub-50ms query latencies, zero client waterfalls, and a hardened security architecture.

Whether deployed 24/7 on free-tier cloud infrastructure (Vercel + Supabase + Cloudflare R2) or self-hosted locally on Windows/Linux with Docker, OES gives administrators granular control while providing employees with an intuitive Progressive Web App (PWA) interface.

---

## ⚡ Key Features

### 🕒 1. Deterministic Overtime (OT) Engine
* **Dynamic Shift Detection**: Automatically detects employee shift policy (First, General, Second, Night) based on punch-in time without requiring rigid shift locks.
* **Configurable Rounding Policies**: Supports exact calculation, `UP_TO_NEXT_15_MINUTES`, `UP_TO_NEXT_30_MINUTES`, `UP_TO_NEXT_1_HOUR`, and nearest rounding intervals.
* **Holiday & Sunday Multipliers**: Automatic weekend recognition and gazetted holiday multiplier adjustments (1.25× / 1.5× / 2.0×).
* **Audit-Proof Snapshots**: Every overtime submission stores an immutable JSON snapshot of the rule version, multiplier, shift schedule, and breakdown at submission time.

### 💳 2. Expense Reimbursement & Anti-Fraud Verification
* **Multi-Proof Attachment System**: High-speed upload supporting JPG, PNG, WEBP, and PDF receipts up to 10 MB per file.
* **Heuristic Duplicate Detection**: Flags suspicious claims sharing identical amounts, dates, or vendor categories submitted within a configurable 30-day window.
* **Instant Receipt Print & Verification**: One-click printable verification records with sanitized print-preview layouts.
* **Audit Feedback Loop**: Administrators can approve, reject with feedback reasons, or undo actions into pending review queues.

### 👥 3. Roster Management & High-Velocity Onboarding
* **Excel Spreadsheet Import**: Upload `.xlsx` rosters to import hundreds of employees in seconds.
* **Multi-Layer Conflict Resolution**: Detects duplicate employee codes or emails against active and deactivated staff before writing to the database.
* **Batch Operations**: Multi-select bulk deactivation, reactivation, and password reset dispatches.
* **Smart Filtering & Exporting**: Fast search across names, codes, departments, and shifts with Excel export capabilities.

### ✉️ 4. Mail Dispatch & Secure Activation Lifecycle
* **Pending vs Registered Onboarding**: Distinct tabbed views segregating pending employee invitations from active accounts.
* **Cryptographic Token Lifecycle**: Generates 7-day single-use activation tokens (`crypto.randomBytes(32)`).
* **Dual-Layer Delivery**: Real-time SMTP dispatch with automated fallback to BullMQ / Valkey background queues.
* **Live Health Diagnostics**: Real-time SMTP connectivity check and queue monitor inside the Admin Mail Console.

### 🛡️ 5. Control Center & Forensic Auditing
* **Tamper-Proof Audit Trail**: Records user ID, IP, user-agent, entity type, before/after states, and timestamps for every administrative mutation.
* **Hard Delete Protection Gate**: Critical purge actions (e.g. database clearing, permanent claim wipes) require explicit administrator password re-authentication.
* **Safe Session Invalidation**: Immediate invalidation of all active session tokens whenever passwords are reset or accounts are deactivated.

### 📱 6. Progressive Web App (PWA)
* **Installable Everywhere**: Native app-like experience on Windows, macOS, Android, and iOS.
* **Offline Resilient**: Service worker caching for lightning-fast loads and low-connectivity environments.
* **Smart Install Modal**: Discreet, non-intrusive install prompt that remembers dismissal per session.

---

## 🏛 System Architecture

<p align="center">
  <img src="./public/architecture.svg" alt="OES System Architecture" width="100%" style="border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);" />
</p>

<details>
<summary><b>🔍 View ASCII / Unicode Architecture Flowchart (Terminal View)</b></summary>
<br />

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER (PWA & WEB APP)                        │
│  ┌───────────────────────┐                    ┌────────────────────────┐  │
│  │   Desktop & Mobile    │◄──────────────────►│   Progressive Web App  │  │
│  │   Browser UI (React)  │                    │   (Offline Service Wkr)│  │
│  └───────────┬───────────┘                    └───────────┬────────────┘  │
└──────────────┼────────────────────────────────────────────┼───────────────┘
               ▼                                            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│              NEXT.JS 15 APPLICATION SERVER (NODE.JS / EDGE)               │
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │               Better Auth Stateful Session Guard                  │   │
│   └─────────────────────────────────┬─────────────────────────────────┘   │
│                                     ▼                                     │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │              Type-Safe Server Actions & REST Handlers             │   │
│   └───────┬─────────────────────────┬─────────────────────────┬───────┘   │
│           │                         │                         │           │
│           ▼                         ▼                         ▼           │
│   ┌───────────────┐         ┌───────────────┐         ┌───────────────┐   │
│   │  OT Engine    │         │ Claim Verifier│         │ Roster Importer│  │
│   │ (Deterministic│         │ (Anti-Fraud & │         │ (Excel Batch  │   │
│   │  Calculations)│         │  Duplicates)  │         │  Conflicts)   │   │
│   └───────┬───────┘         └───────┬───────┘         └───────┬───────┘   │
└───────────┼─────────────────────────┼─────────────────────────┼───────────┘
            ▼                         ▼                         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    DATA PERSISTENCE & SERVICES LAYER                      │
│                                                                           │
│   ┌─────────────────────┐   ┌─────────────────────┐   ┌───────────────┐   │
│   │    PostgreSQL 17    │   │  Cloudflare R2 / S3 │   │ Valkey/Redis  │   │
│   │ (Supabase / Local)  │   │  (Receipt Storage)  │   │ (BullMQ Queue)│   │
│   └─────────────────────┘   └─────────────────────┘   └───────┬───────┘   │
│                                                               │           │
│                                                               ▼           │
│                                                       ┌───────────────┐   │
│                                                       │  SMTP Relay   │   │
│                                                       │(Brevo/Resend) │   │
│                                                       └───────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

</details>

---

## 🚀 Free Cloud Deployment (Supabase + Vercel)

You can host OES **100% free with zero monthly server costs**:

### 1. Database Setup (Supabase PostgreSQL)
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings > Database** and copy your **URI connection string** (Transaction / Session mode, port `5432` or `6543`).
3. Set your password and append `?sslmode=require` to the string:
   ```text
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require
   ```
4. Push the schema and seed initial shifts from your local terminal:
   ```bash
   $env:DATABASE_URL="your_supabase_connection_string"
   npm run db:push
   npm run db:seed
   ```

### 2. Object Storage Setup (Cloudflare R2)
1. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), navigate to **R2** and create a bucket named `oes-receipts` (10 GB free monthly, zero egress fees).
2. Create an **R2 API Token** with *Object Read & Write* permissions.
3. Save your `Access Key ID`, `Secret Access Key`, and S3 API endpoint.

### 3. Deploy to Vercel
1. Fork or import this repository (`MZarc/OES`) into [Vercel](https://vercel.com).
2. Configure the following environment variables:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment state | `production` |
| `NEXT_PUBLIC_APP_URL` | Public site domain | `https://oes-demo.vercel.app` |
| `BETTER_AUTH_URL` | Auth domain | `https://oes-demo.vercel.app` |
| `BETTER_AUTH_SECRET` | 32+ char secret string | `min_32_chars_random_string_here` |
| `DATABASE_URL` | Supabase Postgres URL | `postgresql://...` |
| `STORAGE_ENDPOINT` | Cloudflare R2 endpoint | `https://<account_id>.r2.cloudflarestorage.com` |
| `STORAGE_REGION` | Storage region | `auto` |
| `STORAGE_ACCESS_KEY` | R2 Access Key | `your_access_key` |
| `STORAGE_SECRET_KEY` | R2 Secret Key | `your_secret_key` |
| `STORAGE_BUCKET` | R2 Bucket Name | `oes-receipts` |
| `SMTP_HOST` | SMTP Relay host | `smtp-relay.brevo.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `your_brevo_account` |
| `SMTP_PASS` | SMTP password | `your_smtp_key` |
| `SMTP_FROM` | Outgoing sender | `OES Admin <notifications@yourdomain.com>` |

3. Click **Deploy**. Vercel will build and launch your production instance with instant SSL.

---

## 💻 Quick Start (Local Development)

### Prerequisites
* **Node.js**: v20.x or v22.x
* **Docker Desktop** (optional, for local Postgres/MinIO/Valkey/Mailpit stack)

### 1. Clone & Install
```bash
git clone https://github.com/MZarc/OES.git
cd OES
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Start Local Infrastructure
Using Docker Compose:
```bash
docker compose -f docker/docker-compose.yml up -d
```
* **PostgreSQL 17**: `localhost:5432`
* **Valkey (Redis)**: `localhost:6379`
* **MinIO Storage**: `localhost:9000` (Console: `9001`)
* **Mailpit (Local SMTP Web UI)**: `localhost:1025` (Web UI: `8025`)

### 4. Push Schema & Seed
```bash
npm run db:push
npm run db:seed
```

### 5. Launch with Automated Health Checks
* **Development**: Run `launch.bat` (automatically waits for compilation before opening browser).
* **Production**: Run `launch-prod.bat` (builds and runs optimized standalone server).

---

## 🧪 Testing & Code Quality

OES enforces rigorous code quality and automated testing:

```bash
# Run unit tests
npm test

# Run linter
npm run lint

# Compile production build
npm run build
```

* **Test Suite**: 20/20 unit tests passing (covering OT calculations, error sanitization, Excel roster parsing, and duplicate detection).
* **Lint**: 0 ESLint errors.
* **Bundle Size**: 105 kB shared first-load JS payload.

---

## 📁 Repository Structure

```text
OES/
├── app/                  # Next.js 15 App Router pages & server actions
│   ├── (auth)/           # Login, Password Reset, and Account Activation
│   ├── (employee)/       # Employee Dashboard, OT Form, and Expense Submission
│   ├── admin/            # Admin Control Center, Roster, Mail, and Reports
│   └── api/              # Route handlers (Auth, Attachments, Health probes)
├── components/           # Reusable UI, Table, Modal & Dialog components
├── db/                   # Drizzle ORM schema, client, and database migrations
├── domain/               # Pure business logic (OT rules, expense constraints)
├── lib/                  # Authentication, Email, Queue, Storage & Excel parsers
├── public/               # Static assets, icons, manifest, and service worker
├── tests/                # Vitest automated test suites
├── workers/              # BullMQ queue workers for asynchronous background tasks
├── launch.bat            # Windows 1-click developer launcher with health polling
└── launch-prod.bat       # Windows 1-click production launcher
```

---

## 📄 License
This project is open-source software licensed under the **[MIT License](LICENSE)**.

---

## 👨‍💻 Author & Credits

* **Developed by**: **Meet Mistry**
* **Portfolio / Website**: [meetmistry.vercel.app](https://meetmistry.vercel.app)
* **Email**: [meetzarc@gmail.com](mailto:meetzarc@gmail.com)
* **GitHub**: [@MZarc](https://github.com/MZarc)
* **Repository**: [MZarc/OES](https://github.com/MZarc/OES)

---

<p align="center">
  <sub>Built with ❤️ for precision workforce engineering. Copyright © 2026 Meet Mistry.</sub>
</p>
