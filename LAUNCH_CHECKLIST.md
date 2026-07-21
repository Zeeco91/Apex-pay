# Launch Checklist

Honest inventory of what's actually production-ready vs. what still needs a real-world decision,
credential, or piece of infrastructure this session had no authority or ability to provision.
Organized against the plan's 11 build phases and the Definition of Done in `CLAUDE.md`. Nothing
here should be treated as "someone else already checked this" — every unchecked item is a real
gap, not boilerplate.

## What's built and verified

- [x] Public landing page — responsive, accessible, honest risk disclosure (queue-liquidity,
      capped incentive bonus, referral program mechanics)
- [x] Auth: phone OTP verification, PIN login (Argon2id), JWT access + rotating refresh tokens,
      brute-force protection (per-route throttle + per-account lockout after 5 failed PINs)
- [x] KYC: submission, encrypted-at-rest ID storage, admin approve/reject — gates queue
      participation (verified end-to-end, including the "still blocked while PENDING" case)
- [x] Levels, FIFO queue matching with row-level locking, admin level config editor
- [x] Full pooled payment cycle: join → auto-match → proof upload → admin confirms principal →
      admin disburses → payee confirms — verified end-to-end including the treasury ledger
      entries it produces
- [x] Referral bonuses (30-working-day hold, admin-editable public holiday calendar) and
      level incentive bonuses (hard-capped by real fee-pool balance, never borrowed against)
- [x] Admin panel: user management, KYC review, queue viewer + manual match/hold/release,
      transaction/dispute console, treasury ledger, referral/withdrawal management, level config
- [x] Admin reporting: daily treasury reconciliation (drift detection against ledger history),
      queue-health dashboard, heuristic fraud flags (shared payout accounts, referral bursts),
      searchable/paginated audit log
- [x] Security hardening: `helmet` headers, env-configurable CORS, TOTP MFA mandatory for every
      admin account on every admin route (live-checked, not a trusted JWT claim), accessibility
      pass (label associations, fieldset/legend grouping — found and fixed real gaps beyond what
      automated `jsx-a11y` linting caught)
- [x] Automated tests: unit tests for pure logic (working-day calculator, phone normalization,
      encryption roundtrip) + e2e tests for the identity/KYC-gate, full payment cycle, and admin
      MFA-enforcement flows, run against a real NestJS app + real Postgres

## What's explicitly NOT done — required before real users' money is involved

### Regulatory & legal (do this first — it can change the product)
- [ ] **Legal review of the pooled-collection model itself.** Collecting funds from many members
      and redistributing them is functionally a payment/money-transmission activity in Nigeria —
      this likely implicates CBN payment-service licensing. This is the single biggest
      structural risk in the plan (see plan §10) and hasn't been reviewed by anyone with the
      authority to do so.
- [ ] Terms of Service and Privacy Policy (`apps/web/src/app/terms`, `.../privacy`) are real
      drafts reflecting how the system actually works, clearly marked as requiring qualified
      Nigerian legal counsel sign-off — they have **not** received that review.
- [ ] KYC/AML program review — the platform collects ID type/number and does basic completeness
      checks, but has no sanctions-list screening, no ongoing monitoring, and no defined
      escalation process for suspicious activity beyond the heuristic fraud flags.

### Infrastructure that's currently a dev stand-in
- [ ] **SMS delivery**: `ConsoleSmsProvider` only logs OTP codes, never sends a real SMS. Email
      (via Resend, see `common/email`) is now the primary OTP channel for registration and PIN
      reset, so this only affects the fallback path for accounts with no email on file. A real
      provider (Termii primary, Twilio fallback per plan §1) still needs to be built against the
      existing `SmsProvider` interface and wired into `SmsModule` before that fallback works for
      real users.
- [ ] **File storage**: proof-of-payment images are stored on local disk
      (`LocalDiskStorageProvider`) — fine for one dev machine, not for a real multi-instance
      deployment. Swap in a real provider (S3/R2/similar) behind the existing
      `FileStorageProvider` interface.
- [ ] **Pot/collection bank account**: `POT_ACCOUNT_*` env vars currently hold test values. This
      must become a real, non-personal business bank account before any real contribution is
      accepted (plan §10: "a real (not personal) business bank account for the pot").
- [ ] **Proof image EXIF stripping** was flagged as a hardening-phase gap in `image-validation.util.ts`
      when it was written and was missed during the Phase 10 hardening pass — proof-of-payment
      photos can carry GPS/device EXIF metadata that leaks a user's location. Needs an
      image-processing dependency (e.g. `sharp`) to re-encode uploads and strip metadata.
- [ ] **Payout bank details are stored as plain `Json`, not encrypted** — inconsistent with KYC ID
      numbers and the MFA secret, which do get column-level AES-256-GCM encryption via
      `CryptoService`. Same treatment should be applied here before launch.
- [ ] **No error tracking / APM service** (Sentry or similar) is wired up. `HealthController`
      does check real DB connectivity, and NestJS's `Logger` is used consistently, but nothing
      aggregates or alerts on exceptions in production today.
- [ ] **No dedicated test database.** `npm run test:e2e` runs against whatever `DATABASE_URL` is
      configured — safe (run-unique fixtures) but not isolated. Provision a separate database
      (and ideally a connection pooler — see below) before wiring this into CI.
- [ ] **Neon connection pooling**: the e2e suite occasionally hits transient "transaction not
      found" / connection-reset errors under its own load against Neon's free/shared tier — this
      is an infrastructure characteristic, not a code bug (re-running always goes green), but a
      pooled connection string (Neon's own pooler, or PgBouncer) would remove the flakiness and
      is worth having in any environment beyond a single developer's machine.
- [ ] **No hosting/deployment configuration exists yet** — no Vercel project, no Docker setup, no
      CI pipeline. `npm run build && npm run lint` in each app is the current pre-deploy gate,
      run manually.

### Coverage gaps
- [ ] **No frontend automated tests** (no Playwright/Cypress/component tests) — the admin panel
      and member dashboard have been verified manually (curl + visual checks) across every phase
      but have zero regression coverage of their own.
- [ ] E2E backend coverage stops at the flows in `test/critical-flows.e2e-spec.ts` — it does not
      cover dispute raise/resolve, withdrawal request approve/reject/mark-paid, or the
      reconciliation/fraud-flags/queue-health reporting endpoints. These have all been manually
      verified at least once during the phase that built them, but have no regression test.
- [ ] Device fingerprinting, referenced in the plan's own risk section as a referral-fraud
      mitigation, is never actually captured anywhere in the codebase — the fraud-flags feature
      (Phase 9) was deliberately built on signals that genuinely exist (shared payout bank
      details, referral signup bursts) rather than on this phantom field. Either implement real
      capture or remove the stale assumption from the plan doc.

## Staged rollout recommendation

No infrastructure exists to actually stage a rollout yet, but the system already has one lever
built in that's worth using deliberately rather than accidentally: **`Level.isActive`**. A new
deployment can go live with every level except one (e.g. Bronze, the lowest-stakes) set inactive,
open just that level to a small beta cohort, watch queue-health and reconciliation for a real
operating cycle, then activate the remaining levels once the pooled-payment cycle has proven
itself with real (small) money. Recommended progression:

1. **Dev** → current state, one developer, Neon free tier.
2. **Staging** → separate database, real SMS provider in sandbox/test mode, synthetic users only.
3. **Beta** → real infra, real bank account, one level active, a small invited cohort, daily
   manual review of the reconciliation and fraud-flags pages until they've been trusted for a
   couple of weeks.
4. **General availability** → remaining levels activated, monitoring/alerting proven out during
   beta.

## Monitoring & alerting — current state

- `GET /health` performs a real database ping (`@nestjs/terminus` + `PrismaHealthIndicator`) —
  point an uptime monitor at it.
- The daily reconciliation cron (`ReconciliationService`, `@Cron(EVERY_DAY_AT_MIDNIGHT)`) logs an
  `ERROR`-level line via NestJS `Logger` when drift is detected, but nothing currently pages
  anyone on that log line — wire it into whatever alerting channel is chosen alongside the error
  tracking service above.
- Structured, leveled logging (`Logger`) is used throughout; nothing currently ships those logs
  anywhere durable beyond stdout.

## Final go/no-go gate

Do not accept real user funds until every item in "What's explicitly NOT done" above is either
checked off or consciously accepted as a documented risk by someone with the authority to accept
it. Functional completeness (everything in the first section) is necessary but not sufficient —
see `CLAUDE.md`'s Definition of Done: "Meeting only functional requirements is not enough."
