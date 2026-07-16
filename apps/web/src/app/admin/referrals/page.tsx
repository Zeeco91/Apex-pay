"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { formatNaira } from "@/lib/constants";
import {
  listFeePools,
  listReferralBonusesForAdmin,
  listLevelIncentiveBonusesForAdmin,
  listWithdrawalRequestsForAdmin,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
} from "@/lib/api/admin/referrals";
import { listPublicHolidays, createPublicHoliday, deletePublicHoliday } from "@/lib/api/admin/publicHolidays";
import { formatEnumLabel } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ReasonActionButton } from "@/components/admin/ReasonActionButton";
import type {
  AdminLevelIncentiveBonusView,
  AdminReferralBonusView,
  AdminWithdrawalRequestView,
  FeePoolView,
  PublicHolidayView,
  WithdrawalRequestStatus,
} from "@/types/api";

const WITHDRAWAL_TONE: Record<WithdrawalRequestStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  PAID: "success",
};

type Tab = "withdrawals" | "referral-bonuses" | "incentive-bonuses" | "public-holidays";

export default function AdminReferralsPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("withdrawals");
  const [feePools, setFeePools] = useState<FeePoolView[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRequestView[]>([]);
  const [referralBonuses, setReferralBonuses] = useState<AdminReferralBonusView[]>([]);
  const [incentiveBonuses, setIncentiveBonuses] = useState<AdminLevelIncentiveBonusView[]>([]);
  const [holidays, setHolidays] = useState<PublicHolidayView[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const [pools, withdrawalRequests, refBonuses, incBonuses, publicHolidays] = await Promise.all([
          listFeePools(accessToken),
          listWithdrawalRequestsForAdmin(accessToken),
          listReferralBonusesForAdmin(accessToken),
          listLevelIncentiveBonusesForAdmin(accessToken),
          listPublicHolidays(accessToken),
        ]);
        if (!cancelled) {
          setFeePools(pools);
          setWithdrawals(withdrawalRequests);
          setReferralBonuses(refBonuses);
          setIncentiveBonuses(incBonuses);
          setHolidays(publicHolidays);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load referral data.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleApprove(id: string) {
    if (!accessToken) return;
    const updated = await approveWithdrawal(accessToken, id);
    setWithdrawals((prev) => prev.map((w) => (w.id === id ? updated : w)));
  }

  async function handleReject(id: string, reason: string) {
    if (!accessToken) return;
    const updated = await rejectWithdrawal(accessToken, id, reason);
    setWithdrawals((prev) => prev.map((w) => (w.id === id ? updated : w)));
  }

  async function handleMarkPaid(id: string, reference: string) {
    if (!accessToken) return;
    const updated = await markWithdrawalPaid(accessToken, id, reference);
    setWithdrawals((prev) => prev.map((w) => (w.id === id ? updated : w)));
  }

  async function handleAddHoliday() {
    if (!accessToken) return;
    if (!newHolidayDate || newHolidayName.trim().length === 0) {
      setHolidayError("Provide both a date and a name.");
      return;
    }
    setHolidayError(null);
    try {
      const created = await createPublicHoliday(accessToken, { date: newHolidayDate, name: newHolidayName.trim() });
      setHolidays((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      setNewHolidayDate("");
      setNewHolidayName("");
    } catch (err) {
      setHolidayError(err instanceof ApiError ? err.message : "Failed to add holiday.");
    }
  }

  async function handleDeleteHoliday(id: string) {
    if (!accessToken) return;
    await deletePublicHoliday(accessToken, id);
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  }

  const referralPool = feePools.find((p) => p.poolType === "REFERRAL");
  const incentivePool = feePools.find((p) => p.poolType === "LEVEL_INCENTIVE");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Referrals & Bonuses</h1>
        <p className="mt-1 text-sm text-muted">
          Both bonus types are hard-capped by their fee pool balance — never funded by other members&apos; contributions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Referral pool balance</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatNaira(referralPool?.currentBalance ?? 0)}</p>
          <p className="mt-1 text-xs text-muted">
            Paid lifetime: {formatNaira(referralPool?.totalPaidLifetime ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Incentive pool balance</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatNaira(incentivePool?.currentBalance ?? 0)}</p>
          <p className="mt-1 text-xs text-muted">
            Paid lifetime: {formatNaira(incentivePool?.totalPaidLifetime ?? 0)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["withdrawals", "Withdrawal Requests"],
          ["referral-bonuses", "Referral Bonuses"],
          ["incentive-bonuses", "Incentive Bonuses"],
          ["public-holidays", "Public Holidays"],
        ] as [Tab, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === value ? "bg-primary text-primary-foreground" : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : tab === "withdrawals" ? (
        withdrawals.length === 0 ? (
          <p className="text-sm text-muted">No withdrawal requests yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {withdrawals.map((w) => (
              <div key={w.id} className="rounded-2xl border border-border bg-background p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">
                      {w.userFullName} · {formatNaira(w.amount)}
                    </p>
                    <p className="text-sm text-muted">{w.userPhone}</p>
                  </div>
                  <Badge tone={WITHDRAWAL_TONE[w.status]}>{formatEnumLabel(w.status)}</Badge>
                </div>
                {w.rejectionReason ? <p className="mt-2 text-sm text-danger">Rejected: {w.rejectionReason}</p> : null}
                {w.paymentReference ? (
                  <p className="mt-2 text-sm text-muted">Reference: {w.paymentReference}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {w.status === "PENDING" && (
                    <>
                      <ReasonActionButton
                        label="Approve"
                        variant="primary"
                        reasonRequired={false}
                        reasonLabel="Note (optional)"
                        confirmLabel="Approve"
                        onConfirm={() => handleApprove(w.id)}
                      />
                      <ReasonActionButton
                        label="Reject"
                        reasonLabel="Rejection reason"
                        confirmLabel="Reject"
                        onConfirm={(reason) => handleReject(w.id, reason)}
                      />
                    </>
                  )}
                  {w.status === "APPROVED" && (
                    <ReasonActionButton
                      label="Mark paid"
                      variant="primary"
                      reasonLabel="Payment reference"
                      placeholder="e.g. bank transfer reference"
                      confirmLabel="Mark paid"
                      minLength={2}
                      onConfirm={(reference) => handleMarkPaid(w.id, reference)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "referral-bonuses" ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Referrer</th>
                <th className="px-4 py-3 font-semibold">Referred</th>
                <th className="px-4 py-3 font-semibold">Level</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Hold release</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {referralBonuses.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 text-foreground">{b.referrerFullName}</td>
                  <td className="px-4 py-3 text-foreground">{b.referredFullName}</td>
                  <td className="px-4 py-3 text-muted">{b.levelName}</td>
                  <td className="px-4 py-3 text-muted">{formatNaira(b.bonusAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={b.status === "WITHDRAWN" ? "success" : b.status === "FORFEITED" ? "danger" : "neutral"}>
                      {formatEnumLabel(b.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(b.holdReleaseAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "incentive-bonuses" ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Payee</th>
                <th className="px-4 py-3 font-semibold">Level</th>
                <th className="px-4 py-3 font-semibold">Entitlement</th>
                <th className="px-4 py-3 font-semibold">Paid</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {incentiveBonuses.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 text-foreground">{b.payeeFullName}</td>
                  <td className="px-4 py-3 text-muted">{b.levelName}</td>
                  <td className="px-4 py-3 text-muted">{formatNaira(b.entitlementAmount)}</td>
                  <td className="px-4 py-3 text-foreground">{formatNaira(b.paidAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={b.status === "PAID_IN_FULL" ? "success" : b.status === "SKIPPED_INSUFFICIENT_POOL" ? "danger" : "warning"}>
                      {formatEnumLabel(b.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-background p-6">
            <p className="text-sm font-semibold text-foreground">Add a public holiday</p>
            <p className="mt-1 text-sm text-muted">
              Used to skip non-working days when calculating the referral bonus&apos;s 30-working-day hold period.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Date</label>
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Name</label>
                <input
                  type="text"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  placeholder="e.g. Democracy Day"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted"
                />
              </div>
              <Button variant="primary" className="px-4 py-2 text-xs" onClick={() => void handleAddHoliday()}>
                Add
              </Button>
            </div>
            {holidayError ? <p className="mt-2 text-sm text-danger">{holidayError}</p> : null}
          </div>

          {holidays.length === 0 ? (
            <p className="text-sm text-muted">No public holidays recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-background">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {holidays.map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-3 text-foreground">{new Date(h.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-muted">{h.name}</td>
                      <td className="px-4 py-3">
                        <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => void handleDeleteHoliday(h.id)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
