"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getMyReferralBonuses,
  getMyReferrals,
  getMyWithdrawalRequests,
  requestWithdrawal,
} from "@/lib/api/referrals";
import { ApiError } from "@/lib/api/client";
import { formatNaira } from "@/lib/constants";
import {
  describeReferralBonusStatus,
  describeReferredUserStatus,
  describeWithdrawalRequestStatus,
} from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type {
  ReferralBonusStatus,
  ReferralBonusSummary,
  ReferredUserStatus,
  ReferredUserSummary,
  WithdrawalRequestStatus,
  WithdrawalRequestView,
} from "@/types/api";

const REFERRED_TONE: Record<ReferredUserStatus, BadgeTone> = {
  SIGNED_UP: "neutral",
  BONUS_HELD: "warning",
  BONUS_ELIGIBLE: "success",
  BONUS_WITHDRAWN: "success",
  BONUS_FORFEITED: "danger",
};

const BONUS_TONE: Record<ReferralBonusStatus, BadgeTone> = {
  HOLD: "warning",
  ELIGIBLE_FOR_WITHDRAWAL: "success",
  WITHDRAWN: "success",
  FORFEITED: "danger",
};

const WITHDRAWAL_TONE: Record<WithdrawalRequestStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  PAID: "success",
};

interface LoadedState {
  referrals: ReferredUserSummary[];
  bonuses: ReferralBonusSummary[];
  withdrawals: WithdrawalRequestView[];
}

export default function DashboardReferralsPage() {
  const { user, accessToken } = useAuth();
  const [state, setState] = useState<LoadedState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [withdrawErrorsByBonus, setWithdrawErrorsByBonus] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    loadAll(accessToken).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setState({ referrals: result.referrals, bonuses: result.bonuses, withdrawals: result.withdrawals });
      } else {
        setLoadError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function refresh() {
    if (!accessToken) return;
    const result = await loadAll(accessToken);
    if (result.ok) {
      setState({ referrals: result.referrals, bonuses: result.bonuses, withdrawals: result.withdrawals });
    }
  }

  async function handleCopyCode() {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Non-fatal — the code is visible on screen regardless.
    }
  }

  async function handleWithdraw(bonusId: string) {
    if (!accessToken) return;
    setWithdrawingId(bonusId);
    setWithdrawErrorsByBonus((prev) => ({ ...prev, [bonusId]: "" }));
    try {
      await requestWithdrawal(accessToken, bonusId);
      await refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't request withdrawal. Please try again.";
      setWithdrawErrorsByBonus((prev) => ({ ...prev, [bonusId]: message }));
    } finally {
      setWithdrawingId(null);
    }
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Referrals</h1>
        <p className="mt-1 text-sm text-muted">
          Share your code. Your bonus is credited once a referral&apos;s first contribution cycle is
          confirmed complete — never at sign-up.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-background p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Your referral code</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-surface px-3 py-2 text-lg font-bold tracking-wide text-foreground">
            {user.referralCode}
          </code>
          <button
            type="button"
            onClick={() => void handleCopyCode()}
            className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
          >
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {loadError}
        </div>
      ) : state === null ? (
        <ListSkeleton />
      ) : (
        <>
          <section>
            <h2 className="text-lg font-semibold text-foreground">People you&apos;ve referred</h2>
            {state.referrals.length === 0 ? (
              <EmptyCard message="Nobody has signed up with your code yet." />
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {state.referrals.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-background p-5"
                  >
                    <div>
                      <p className="font-medium text-foreground">{r.fullName}</p>
                      <p className="text-sm text-muted">
                        Joined {new Date(r.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge tone={REFERRED_TONE[r.status]}>{describeReferredUserStatus(r.status)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Your referral bonuses</h2>
            {state.bonuses.length === 0 ? (
              <EmptyCard message="No bonuses yet — they appear once a referral completes their first contribution cycle." />
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {state.bonuses.map((b) => {
                  const canWithdraw = b.status === "ELIGIBLE_FOR_WITHDRAWAL" && !b.hasWithdrawalRequest;
                  const isWithdrawing = withdrawingId === b.id;
                  const withdrawError = withdrawErrorsByBonus[b.id];
                  return (
                    <div key={b.id} className="rounded-2xl border border-border bg-background p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {formatNaira(b.bonusAmount)} — {b.levelName}
                          </p>
                          <p className="text-sm text-muted">
                            From {b.referredUserFullName}
                            {b.status === "HOLD"
                              ? ` — available ${new Date(b.holdReleaseAt).toLocaleDateString()}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge tone={BONUS_TONE[b.status]}>{describeReferralBonusStatus(b.status)}</Badge>
                          {canWithdraw && (
                            <Button
                              type="button"
                              variant="outline"
                              isLoading={isWithdrawing}
                              onClick={() => void handleWithdraw(b.id)}
                            >
                              {isWithdrawing ? "Requesting…" : "Withdraw"}
                            </Button>
                          )}
                        </div>
                      </div>
                      {withdrawError && (
                        <p role="alert" className="mt-2 text-sm text-danger">
                          {withdrawError}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Withdrawal requests</h2>
            {state.withdrawals.length === 0 ? (
              <EmptyCard message="No withdrawal requests yet." />
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {state.withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-background p-5"
                  >
                    <div>
                      <p className="font-medium text-foreground">{formatNaira(w.amount)}</p>
                      <p className="text-sm text-muted">
                        Requested {new Date(w.createdAt).toLocaleDateString()}
                      </p>
                      {w.status === "REJECTED" && w.rejectionReason && (
                        <p className="mt-1 text-sm text-danger">{w.rejectionReason}</p>
                      )}
                      {w.status === "PAID" && w.paymentReference && (
                        <p className="mt-1 text-sm text-muted">Reference: {w.paymentReference}</p>
                      )}
                    </div>
                    <Badge tone={WITHDRAWAL_TONE[w.status]}>{describeWithdrawalRequestStatus(w.status)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

async function loadAll(
  accessToken: string,
): Promise<
  | { ok: true; referrals: ReferredUserSummary[]; bonuses: ReferralBonusSummary[]; withdrawals: WithdrawalRequestView[] }
  | { ok: false; message: string }
> {
  try {
    const [referrals, bonuses, withdrawals] = await Promise.all([
      getMyReferrals(accessToken),
      getMyReferralBonuses(accessToken),
      getMyWithdrawalRequests(accessToken),
    ]);
    return { ok: true, referrals, bonuses, withdrawals };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof ApiError ? err.message : "Couldn't load your referral info. Please try again.",
    };
  }
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-background p-6 text-center text-sm text-muted">
      {message}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}
