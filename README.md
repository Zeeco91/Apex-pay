# Apex Pay

A contribution-based savings queue for the Nigerian market. Members join a fixed-contribution
level, get matched FIFO with another member, and move through the queue in order — contributions
and payouts flow directly between members' bank accounts, routed through a single platform pot
account and confirmed by an admin at each step. Referral and level-incentive bonuses are funded
entirely from platform fee revenue, capped by what's actually accumulated, and never guaranteed.

This is **not an investment product**. See [`apps/web/src/app/terms`](apps/web/src/app/terms/page.tsx)
and the FAQ on the landing page for the full, honest framing — including the queue-liquidity risk
disclosure that governs how payout timing is described anywhere in the product.

The full build plan, phase-by-phase, lives at
`C:\Users\emmanuel\.claude\plans\this-all-is-the-humming-gizmo.md` — this README is the
practical "how do I run this" companion to that plan, not a replacement for it.

## Status

All 11 build phases are complete: landing page, auth/KYC, levels, queue matching, pooled
payments, referrals/incentive bonuses, admin panel, admin reporting/reconciliation, security
hardening (MFA, rate limiting, headers), and this QA/launch pass. See
[`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md) for exactly what's real vs. what still needs a
human decision or real-world credentials before this can accept actual users' money.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL (Neon in dev) via Prisma ORM |
| Auth | Phone OTP + 4-digit PIN (Argon2id), JWT access + rotating refresh tokens, TOTP MFA for admins |
| File storage | Local disk in dev, behind a swappable `FileStorageProvider` interface |
| SMS | Console/log-only in dev, behind a swappable `SmsProvider` interface (real Termii/Twilio integration not yet wired) |

## Repository layout

```
apps/
  api/    NestJS backend — one domain module per bounded context (auth, users, kyc, levels,
          queue, transactions, referrals, reconciliation, queue-health, fraud-flags, admin
          panel controllers alongside each domain's member-facing controller)
  web/    Next.js frontend — public landing page, member dashboard, admin console (/admin)
```

Each domain module in `apps/api/src/modules/*` follows the same shape: a `*.service.ts` holding
both member and admin business logic, a member-facing controller, and (where applicable) a
separate `Admin*Controller` sharing that same service.

## Prerequisites

- Node.js 20+
- A PostgreSQL database (the project was built against [Neon](https://neon.tech)'s free tier —
  any Postgres works, but see the note on connection pooling in `LAUNCH_CHECKLIST.md` before
  relying on it for anything beyond local dev)

## Setup

```bash
# 1. Install dependencies for both apps
cd apps/api && npm install
cd ../web && npm install

# 2. Configure environment variables
cd ../api && cp .env.example .env
cd ../web && cp .env.example .env.local
# Fill in DATABASE_URL and generate the secrets .env.example points to — every secret has a
# one-line `node -e "..."` generator command right next to it in the file.

# 3. Apply the database schema and seed the 6 contribution levels + public holiday calendar
cd ../api
npm run prisma:migrate
npm run prisma:seed

# 4. Run both apps in dev mode (separate terminals)
npm run start:dev          # from apps/api — http://localhost:4000
cd ../web && npm run dev   # from apps/web — http://localhost:3000
```

The frontend's `NEXT_PUBLIC_API_URL` in `.env.local` must point at the backend's versioned API
base (`http://localhost:4000/api/v1` by default).

### Creating your first admin

Registration always creates a `USER`-role account. To reach `/admin`, promote a user's `role` to
`ADMIN` directly in the database (e.g. via `npm run prisma:studio`), then log in and complete
MFA setup — every admin route rejects `ADMIN`/`SUPER_ADMIN` accounts without MFA enabled
(`/admin/mfa-setup` in the app, or `POST /auth/mfa/setup` → `POST /auth/mfa/verify-setup`
directly against the API).

## Environment variables

See `apps/api/.env.example` and `apps/web/.env.example` for the full, current list — each
variable there has an inline comment explaining what it's for and, for secrets, exactly how to
generate a real value. Nothing in this README duplicates that list, to avoid the two drifting
out of sync.

## Testing

```bash
cd apps/api
npm run test        # unit tests — pure logic, no DB (working-day calculator, phone
                     # normalization, encryption roundtrip)
npm run test:e2e     # integration tests — real NestJS app, real Postgres, covering the
                     # register→KYC-gate→queue-join, full pooled-payment-cycle, and admin
                     # MFA-enforcement flows end to end
```

`test:e2e` runs against whatever `DATABASE_URL` is configured (there's no separate test database
yet — see `LAUNCH_CHECKLIST.md`). Every fixture it creates uses a run-unique phone number, so
repeated runs never collide with each other or with manually-created accounts.

The frontend has no automated test suite yet (see `LAUNCH_CHECKLIST.md`).

```bash
# Both apps, before committing:
npm run build && npm run lint   # run in each of apps/api and apps/web
```

## Architecture notes worth knowing before you touch the code

- **Every admin action that's discretionary or moves money is audit-logged** — see
  `AuditLogService` (`apps/api/src/common/audit-log`). If you add a new admin mutation, add an
  `AdminActionType` for it and call `auditLog.record(...)` inside the same DB transaction as the
  mutation itself.
- **Multi-step DB transactions against Postgres must use `EXTENDED_TX_OPTIONS`**
  (`apps/api/src/common/prisma/transaction-options.util.ts`) — Prisma's default 5-second
  interactive-transaction timeout is tight enough that a transaction doing 4+ sequential
  round-trips to a remote Postgres can exceed it. This has caused real bugs more than once in
  this codebase; when adding a new multi-step `$transaction`, use the extended options by
  default rather than waiting to hit the timeout in production.
- **Sensitive fields are encrypted at the column level** via `CryptoService` (AES-256-GCM) — KYC
  ID numbers, payout bank details are not literally true (bank details are stored as plain
  `Json` today, not yet encrypted — see `LAUNCH_CHECKLIST.md`), and the admin TOTP secret. Never
  add a new sensitive field without deciding whether it needs the same treatment.
- **`PublicUser`/similar "safe to send to the client" types are explicit allow-lists**, not
  destructured omissions — a new sensitive field on `User` is excluded from client responses by
  default, and has to be deliberately added to reach the client. Keep that pattern.
- **MFA enforcement is a live DB check in `RolesGuard`**, not a trusted JWT claim — this was a
  deliberate choice after finding that an MFA "pending" token could otherwise be used as a full
  bearer credential if the check only lived in the JWT payload (see `mfa.service.ts` and
  `strategies/jwt-access.strategy.ts` for how the pending token is scoped to be unusable
  anywhere else).
