// Lightweight load smoke test (plan §10 "load testing at target scale").
//
// Scope and honest limits: this hits the locally-running dev API + dev Postgres (via Neon, a
// remote pooled connection — not a production-equivalent DB tier), not real production
// infrastructure. It only exercises safe-to-repeat READ paths; queue-join/disbursement/etc. have
// real business-state side effects (unique-active-entry constraints, real money-movement
// semantics) that make them unsuitable for blind concurrent hammering without dedicated
// per-request fixture teardown. Treat these numbers as a baseline sanity check, not a capacity
// guarantee — re-run against a staging environment sized like production before trusting them
// for a real go/no-go call.
//
// Usage: node load-tests/run.mjs [baseUrl] [adminAccessToken]
//
// adminAccessToken is a bearer token for an admin account that already has MFA enabled — obtain
// one via the normal login + /auth/mfa/login-verify flow first (MFA is mandatory on every
// /admin/* route as of the plan §10 hardening pass, so a plain phone+PIN login can't reach an
// admin endpoint here).
import autocannon from 'autocannon';

const baseUrl = process.argv[2] ?? 'http://localhost:4000';
const adminAccessToken = process.argv[3];

const TARGET_SCALE_CONNECTIONS = 50; // plan §10: sized for the 500-1000 total-user assumption, not concurrent-request load
const DURATION_SECONDS = 15;

async function run(name, opts) {
  console.log(`\n=== ${name} ===`);
  const result = await autocannon({
    connections: TARGET_SCALE_CONNECTIONS,
    duration: DURATION_SECONDS,
    ...opts,
  });
  console.log(
    `requests/sec: avg=${result.requests.average} p99=${result.requests.p99} | ` +
      `latency ms: avg=${result.latency.average} p99=${result.latency.p99} | ` +
      `2xx=${result['2xx']} non-2xx=${result.non2xx} errors=${result.errors} timeouts=${result.timeouts}`,
  );
  return result;
}

async function main() {
  await run('GET /health', { url: `${baseUrl}/health` });

  await run('GET /api/v1/levels (public, unauthenticated)', {
    url: `${baseUrl}/api/v1/levels`,
  });

  if (adminAccessToken) {
    await run('GET /api/v1/admin/users (authenticated admin read)', {
      url: `${baseUrl}/api/v1/admin/users`,
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
  } else {
    console.log('\nSkipping authenticated admin-read benchmark — pass an admin access token as argv[3] to include it.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
