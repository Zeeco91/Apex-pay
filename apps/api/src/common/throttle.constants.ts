// Jest sets NODE_ENV=test automatically before any module loads. Real production limits are
// deliberately tight (a 4-digit PIN has a small keyspace — see auth.controller.ts), but the e2e
// suite (real requests, real Postgres, all from one loopback "IP") legitimately exceeds them
// just by running its normal cross-scenario traffic. The limiter's actual production behavior
// is covered by manual verification (Phase 10), not by that suite — so both limits below scale
// up together for test runs rather than drifting out of sync with two separate env checks.
const IS_TEST = process.env.NODE_ENV === 'test';

export const DEFAULT_THROTTLE_LIMIT = IS_TEST ? 10_000 : 20;
export const LOGIN_THROTTLE_LIMIT = IS_TEST ? 10_000 : 5;

// A support chat is interactive but not a firehose — 30/min comfortably covers a real
// back-and-forth conversation while still blocking a scripted spam loop.
export const CHAT_MESSAGE_THROTTLE_LIMIT = IS_TEST ? 10_000 : 30;
