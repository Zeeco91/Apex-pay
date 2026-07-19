"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { getFraudFlags } from "@/lib/api/admin/fraudFlags";
import { Badge } from "@/components/ui/Badge";
import type { FraudFlagsSummary } from "@/types/api";

export default function AdminFraudFlagsPage() {
  const { accessToken } = useAuth();
  const [flags, setFlags] = useState<FraudFlagsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getFraudFlags(accessToken);
        if (!cancelled) {
          setFlags(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load fraud flags.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const totalFlags = (flags?.sharedBankDetails.length ?? 0) + (flags?.referralBursts.length ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Fraud Flags</h1>
        <p className="mt-1 text-sm text-muted">
          Heuristic signals, not proof — these direct human review, they never auto-block anyone.
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Scanning for flags…</p>
      ) : totalFlags === 0 ? (
        <p className="text-sm text-muted">No flags right now.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {flags && flags.sharedBankDetails.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-foreground">Shared payout accounts</h2>
              <p className="text-sm text-muted">
                Multiple distinct accounts pointing payouts at the same bank account number — a strong
                self-referral signal.
              </p>
              {flags.sharedBankDetails.map((flag) => (
                <div key={flag.accountNumber} className="rounded-2xl border border-danger/40 bg-danger/5 p-6">
                  <div className="flex items-center gap-2">
                    <Badge tone="danger">{flag.users.length} accounts</Badge>
                    <p className="text-sm text-foreground">
                      {flag.bankName} · {flag.accountNumber}
                    </p>
                  </div>
                  <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
                    {flag.users.map((user) => (
                      <li key={user.id}>
                        {user.fullName} · {user.phone}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {flags && flags.referralBursts.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-foreground">Referral bursts</h2>
              <p className="text-sm text-muted">
                An unusually large number of referred signups from one referrer within a short window.
              </p>
              {flags.referralBursts.map((flag, index) => (
                <div
                  key={`${flag.referrer.id}-${flag.windowStart}-${index}`}
                  className="rounded-2xl border border-warning/40 bg-warning/5 p-6"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone="warning">{flag.referredCount} referrals</Badge>
                    <p className="text-sm text-foreground">
                      {flag.referrer.fullName} · {flag.referrer.phone}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Window starting {new Date(flag.windowStart).toLocaleString()}
                  </p>
                  <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
                    {flag.referredUsers.map((user) => (
                      <li key={user.id}>
                        {user.fullName} · {user.phone}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
