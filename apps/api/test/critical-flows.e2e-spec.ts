import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import {
  generate as generateTotp,
  generateSecret as generateTotpSecret,
} from 'otplib';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CryptoService } from '../src/common/crypto/crypto.service';
import {
  SMS_PROVIDER,
  type SmsProvider,
} from '../src/common/sms/sms-provider.interface';

/**
 * End-to-end coverage for the platform's highest-stakes flows (plan §11): identity/auth, the
 * full pooled contribution→disbursement cycle, and admin MFA enforcement. These hit a real
 * NestJS app instance (real Prisma, real Postgres —
 * the same DATABASE_URL as `npm run start:dev`) with only the SMS provider swapped for a
 * capturing test double, since no real SMS transport exists yet (plan §1).
 *
 * No dedicated test database is provisioned yet — see LAUNCH_CHECKLIST.md. Every fixture below
 * uses a run-unique phone number so repeated runs never collide with each other or with
 * hand-created fixtures from manual testing.
 *
 * The login-throttle limit is raised in AppModule when NODE_ENV=test (which Jest sets
 * automatically) — every request in this suite originates from the same in-process loopback
 * "IP", so the production limit (5/min) would otherwise trip on nothing more than this suite's
 * own normal cross-scenario traffic. The limiter's actual behavior was verified manually in
 * Phase 10 and isn't this suite's concern — it tests business-flow correctness, not
 * cross-cutting infra.
 *
 * Known flakiness: this suite occasionally fails with a transient 500 (Prisma "transaction not
 * found" / connection reset) on an otherwise-passing run — Neon's free/shared tier under this
 * suite's ~20 concurrent-ish interactive transactions, not a logic bug (re-running has always
 * gone green — see LAUNCH_CHECKLIST.md). A dedicated test database with a pooler (PgBouncer, or
 * Neon's own pooled connection string) is the real fix, not yet provisioned.
 */

class CapturingSmsProvider implements SmsProvider {
  private codesByPhone = new Map<string, string>();

  sendOtp(phone: string, code: string): Promise<void> {
    this.codesByPhone.set(phone, code);
    return Promise.resolve();
  }

  codeFor(phone: string): string {
    const code = this.codesByPhone.get(phone);
    if (!code) throw new Error(`No OTP was sent to ${phone} in this test run`);
    return code;
  }
}

const RUN_ID = Date.now() % 100_000_000;
let phoneCounter = 0;
function uniquePhone(): string {
  phoneCounter += 1;
  const suffix = `${RUN_ID}`.padStart(8, '0').slice(-8);
  return `+2348${suffix}${phoneCounter % 10}`;
}

// Includes RUN_ID (not just the per-run counter) so re-running this suite never collides with
// leftover rows from a previous run — phoneCounter alone repeats 1, 2, 3... every run.
function uniqueReferralCode(label: string): string {
  return `E2E${RUN_ID.toString(36).toUpperCase()}${phoneCounter}${label.slice(0, 2).toUpperCase()}`;
}

describe('Critical flows (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sms: CapturingSmsProvider;

  beforeAll(async () => {
    sms = new CapturingSmsProvider();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Creates an ACTIVE admin directly via Prisma, with MFA left disabled — used
   * only by the dedicated MFA-enforcement suite below, which tests that setup/enforcement
   * mechanic itself. Every other suite uses createTestAdmin (MFA pre-enabled) instead, since
   * re-proving MFA enforcement in every suite would just be redundant setup cost. */
  async function createTestAdminWithoutMfa(): Promise<{
    phone: string;
    pin: string;
  }> {
    const phone = uniquePhone();
    const pin = '1234';
    await prisma.user.create({
      data: {
        phone,
        fullName: 'E2E Test Admin',
        pinHash: await argon2.hash(pin, { type: argon2.argon2id }),
        referralCode: uniqueReferralCode('Admin'),
        phoneVerifiedAt: new Date(),
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    return { phone, pin };
  }

  /** Admin fixture with MFA already enabled (admin routes reject ADMIN/SUPER_ADMIN accounts
   * without it — Phase 10 hardening), so suites focused on other flows can get a working admin
   * token via loginAdminWithMfa without re-running the setup dance themselves. */
  async function createTestAdmin(): Promise<{
    phone: string;
    pin: string;
    mfaSecret: string;
  }> {
    const { phone, pin } = await createTestAdminWithoutMfa();
    const mfaSecret = generateTotpSecret();
    const crypto = app.get(CryptoService);
    await prisma.user.update({
      where: { phone },
      data: { mfaEnabled: true, mfaSecret: crypto.encrypt(mfaSecret) },
    });
    return { phone, pin, mfaSecret };
  }

  async function loginAdminWithMfa(admin: {
    phone: string;
    pin: string;
    mfaSecret: string;
  }): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: admin.phone, pin: admin.pin })
      .expect(201);
    expect(login.body.data.mfaRequired).toBe(true);
    const code = await generateTotp({ secret: admin.mfaSecret });
    const verified = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/login-verify')
      .send({ mfaPendingToken: login.body.data.mfaPendingToken, code })
      .expect(201);
    return verified.body.data.accessToken as string;
  }

  /** Active member, created directly for tests whose focus is downstream of registration. */
  async function createApprovedMember(
    label: string,
  ): Promise<{ phone: string; pin: string; id: string }> {
    const phone = uniquePhone();
    const pin = '1234';
    const user = await prisma.user.create({
      data: {
        phone,
        fullName: `E2E ${label}`,
        pinHash: await argon2.hash(pin, { type: argon2.argon2id }),
        referralCode: uniqueReferralCode(label),
        phoneVerifiedAt: new Date(),
        status: 'ACTIVE',
        payoutBankDetails: {
          bankName: 'Test Bank',
          accountNumber: `00${phoneCounter}00000${phoneCounter}`,
          accountName: `E2E ${label}`,
        },
      },
    });
    return { phone, pin, id: user.id };
  }

  async function loginFor(phone: string, pin: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, pin })
      .expect(201);
    expect(res.body.data.mfaRequired).toBe(false);
    return res.body.data.accessToken as string;
  }

  // 1x1 transparent PNG — real magic bytes, satisfies validateProofImage without needing a
  // fixture file on disk.
  const MINIMAL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  describe('Auth: register → OTP verify → login → refresh → logout', () => {
    const phone = uniquePhone();
    const pin = '4321';
    let accessToken: string;
    const agent = () => request.agent(app.getHttpServer());
    let sessionAgent: ReturnType<typeof agent>;

    it('rejects registration before phone verification', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ phone, fullName: 'E2E New User', pin })
        .expect(401);
    });

    it('requests and verifies an OTP, then registers', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone, purpose: 'REGISTER' })
        .expect(201);

      const code = sms.codeFor(phone);
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone, purpose: 'REGISTER', code })
        .expect(201);

      sessionAgent = agent();
      const res = await sessionAgent
        .post('/api/v1/auth/register')
        .send({ phone, fullName: 'E2E New User', pin })
        .expect(201);

      expect(res.body.data.user.phone).toBe(phone);
      expect(res.body.data.user.status).toBe('ACTIVE');
      expect(res.body.data.user.mfaEnabled).toBe(false);
      accessToken = res.body.data.accessToken;
    });

    it('accepts the new PIN on a fresh login', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone, pin })
        .expect(201);
      expect(res.body.data.mfaRequired).toBe(false);
      expect(res.body.data.accessToken).toBeTruthy();
    });

    it('rotates the refresh token using the httpOnly cookie set at register', async () => {
      const res = await sessionAgent.post('/api/v1/auth/refresh').expect(201);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.accessToken).not.toBe(accessToken);
    });

    it('/users/me works with the current access token', async () => {
      const me = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(me.body.data.phone).toBe(phone);
    });

    it('logs out and revokes the session', async () => {
      await sessionAgent.post('/api/v1/auth/logout').expect(201);
      // The rotated refresh token is now revoked — trying to refresh again must fail.
      await sessionAgent.post('/api/v1/auth/refresh').expect(401);
    });
  });

  describe('Full pooled contribution cycle: join → match → proof → confirm → disburse → payee confirms', () => {
    let payer: { phone: string; pin: string; id: string };
    let payee: { phone: string; pin: string; id: string };
    let payerToken: string;
    let payeeToken: string;
    let adminToken: string;
    let levelId: string;
    let transactionId: string;

    beforeAll(async () => {
      const admin = await createTestAdmin();
      adminToken = await loginAdminWithMfa(admin);

      const levels = await request(app.getHttpServer())
        .get('/api/v1/levels')
        .expect(200);
      levelId = levels.body.data[1].id;

      // Defensive cleanup: an earlier failed run of this same suite (no dedicated test DB yet —
      // see LAUNCH_CHECKLIST.md) can leave a WAITING_FOR_PAYOUT entry behind, which would
      // auto-match with "payee" below before "payer" ever joins and break every assumption after
      // it. Cancelling any pre-existing E2E-fixture entries in this level keeps the suite
      // self-healing across runs instead of requiring manual DB cleanup.
      await prisma.queueEntry.updateMany({
        where: {
          levelId,
          status: 'WAITING_FOR_PAYOUT',
          user: { fullName: { startsWith: 'E2E ' } },
        },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      payee = await createApprovedMember('Payee');
      payer = await createApprovedMember('Payer');
      payeeToken = await loginFor(payee.phone, payee.pin);
      payerToken = await loginFor(payer.phone, payer.pin);
    });

    it('first join waits; second join auto-matches them', async () => {
      const first = await request(app.getHttpServer())
        .post(`/api/v1/levels/${levelId}/queue-entries`)
        .set('Authorization', `Bearer ${payeeToken}`)
        .expect(201);
      expect(first.body.data.matched).toBe(false);

      const second = await request(app.getHttpServer())
        .post(`/api/v1/levels/${levelId}/queue-entries`)
        .set('Authorization', `Bearer ${payerToken}`)
        .expect(201);
      expect(second.body.data.matched).toBe(true);
      transactionId = second.body.data.entry.transactionId;
      expect(transactionId).toBeTruthy();
      expect(second.body.data.entry.transactionStatus).toBe(
        'AWAITING_PAYER_PROOF',
      );
    });

    it('payer uploads proof of payment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/transactions/${transactionId}/proof`)
        .set('Authorization', `Bearer ${payerToken}`)
        .attach('file', MINIMAL_PNG, {
          filename: 'proof.png',
          contentType: 'image/png',
        })
        .expect(201);
      expect(res.body.data.status).toBe('PROOF_SUBMITTED');
    });

    it('admin confirms principal received, then disburses to the payee', async () => {
      const confirmed = await request(app.getHttpServer())
        .post(`/api/v1/admin/transactions/${transactionId}/confirm-principal`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      expect(confirmed.body.data.status).toBe('PENDING_DISBURSEMENT');

      const disbursed = await request(app.getHttpServer())
        .post(`/api/v1/admin/transactions/${transactionId}/disburse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reference: 'E2E-TEST-REF-001' })
        .expect(201);
      expect(disbursed.body.data.status).toBe('DISBURSED');
    });

    it('payee confirms receipt, completing the cycle', async () => {
      const confirmed = await request(app.getHttpServer())
        .post(`/api/v1/transactions/${transactionId}/confirm`)
        .set('Authorization', `Bearer ${payeeToken}`)
        .expect(201);
      expect(confirmed.body.data.status).toBe('CONFIRMED');
    });

    it('the treasury ledger recorded both the collection and the disbursement', async () => {
      const ledger = await request(app.getHttpServer())
        .get('/api/v1/admin/treasury-ledger')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const entries = ledger.body.data.filter(
        (e: { relatedTransactionId: string | null }) =>
          e.relatedTransactionId === transactionId,
      );
      expect(
        entries.some(
          (e: { entryType: string }) => e.entryType === 'PRINCIPAL_COLLECTED',
        ),
      ).toBe(true);
      expect(
        entries.some((e: { entryType: string }) => e.entryType === 'DISBURSED'),
      ).toBe(true);
    });
  });

  describe('Admin MFA enforcement', () => {
    let admin: { phone: string; pin: string };
    let firstAccessToken: string;

    beforeAll(async () => {
      admin = await createTestAdminWithoutMfa();
    });

    it('logs in directly (no MFA yet) but is blocked from admin routes', async () => {
      firstAccessToken = await loginFor(admin.phone, admin.pin);
      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${firstAccessToken}`)
        .expect(403);
    });

    it('completes MFA setup and is then required to use it on the next login', async () => {
      const setup = await request(app.getHttpServer())
        .post('/api/v1/auth/mfa/setup')
        .set('Authorization', `Bearer ${firstAccessToken}`)
        .expect(201);
      const { secret } = setup.body.data;

      const code = await generateTotp({ secret });
      await request(app.getHttpServer())
        .post('/api/v1/auth/mfa/verify-setup')
        .set('Authorization', `Bearer ${firstAccessToken}`)
        .send({ code })
        .expect(201);

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: admin.phone, pin: admin.pin })
        .expect(201);
      expect(login.body.data.mfaRequired).toBe(true);
      const { mfaPendingToken } = login.body.data;

      // The pending token must never work as a real bearer credential on its own — this is a
      // regression guard for the pending-token-as-bypass bug found and fixed in Phase 10.
      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${mfaPendingToken}`)
        .expect(401);

      const secondCode = await generateTotp({ secret });
      const verified = await request(app.getHttpServer())
        .post('/api/v1/auth/mfa/login-verify')
        .send({ mfaPendingToken, code: secondCode })
        .expect(201);

      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${verified.body.data.accessToken}`)
        .expect(200);
    });
  });
});
