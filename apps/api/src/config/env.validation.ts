import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .url({ message: 'DATABASE_URL must be a valid connection string' }),

  // Auth
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Column-level encryption (KYC IDs, bank details) — 32-byte key, hex-encoded (64 hex chars).
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
