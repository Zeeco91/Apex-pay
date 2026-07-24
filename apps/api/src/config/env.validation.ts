import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .url({ message: 'DATABASE_URL must be a valid connection string' }),

  // Comma-separated list of allowed frontend origins in production (e.g.
  // "https://apexpay.example,https://admin.apexpay.example"). Left unset in development, where
  // main.ts falls back to a fixed localhost/tunnel allowlist instead.
  CORS_ORIGINS: z.string().optional(),

  // Auth
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Column-level encryption (bank details) — 32-byte key, hex-encoded (64 hex chars).
  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-f]{64}$/i,
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    ),

  // Keyed hash for OTP codes (HMAC pepper) — separate from ENCRYPTION_KEY by design.
  OTP_HMAC_SECRET: z
    .string()
    .min(32, 'OTP_HMAC_SECRET must be at least 32 characters'),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_REQUEST_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_REQUEST_MAX_PER_WINDOW: z.coerce.number().int().positive().default(5),
  OTP_REQUEST_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),

  // Email OTP delivery (interim channel while SMS delivery is unavailable — see
  // common/email/email.module.ts). EmailModule prefers AWS SES (if configured) over Resend
  // over logging the code to the console; unset in production with neither configured fails
  // fast at boot. EMAIL_FROM must be a sender verified with whichever provider is active.
  RESEND_API_KEY: z.string().optional(),
  AWS_SES_ACCESS_KEY_ID: z.string().optional(),
  AWS_SES_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SES_REGION: z.string().default('us-east-1'),
  EMAIL_FROM: z.string().default('APEX PAY <onboarding@resend.dev>'),

  // Single platform-wide collection account (plan §2) — payers are shown these details, never
  // the payee's. Editable admin settings UI arrives with the Admin Panel Core phase; a static,
  // operator-configured account is the correct MVP shape until then.
  POT_ACCOUNT_BANK_NAME: z.string().min(1).default('Not configured'),
  POT_ACCOUNT_NUMBER: z.string().min(1).default('0000000000'),
  POT_ACCOUNT_NAME: z.string().min(1).default('Not configured'),

  // Signing secret for proof-of-payment file access tokens (dev-local-disk storage only —
  // a real S3/R2 provider issues its own signed URLs and won't need this).
  FILE_ACCESS_HMAC_SECRET: z
    .string()
    .min(32, 'FILE_ACCESS_HMAC_SECRET must be at least 32 characters'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Fails fast at boot with a readable error instead of letting the app start
 * with missing/malformed config and fail confusingly later.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
