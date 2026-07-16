"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { formatNaira } from "@/lib/constants";
import { getTreasuryLedger } from "@/lib/api/admin/transactions";
import { formatEnumLabel } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { TreasuryEntryType, TreasuryLedgerEntryView } from "@/types/api";

const ENTRY_TONE: Record<TreasuryEntryType, BadgeTone> = {
  PRINCIPAL_COLLECTED: "success",
  DISBURSED: "danger",
  FEE_COLLECTED: "info",
  FEE_ALLOCATED_REFERRAL_POOL: "neutral",
  FEE_ALLOCATED_INCENTIVE_POOL: "neutral",
  FEE_ALLOCATED_PLATFORM_REVENUE: "neutral",
  REFERRAL_BONUS_PAID: "danger",
  LEVEL_INCENTIVE_BONUS_PAID: "danger",
  PLATFORM_REVENUE_WITHDRAWN: "danger",
};

export default function AdminTreasuryPage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<TreasuryLedgerEntryView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getTreasuryLedger(accessToken)
      .then((data) => setEntries([...data].reverse()))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load the treasury ledger."))
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  const currentBalance = entries[0]?.balanceAfter ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Treasury Ledger</h1>
        <p className="mt-1 text-sm text-muted">
          Read-only record of every movement that affects the pooled pot balance.
        </p>
      </div>

      {!isLoading && !error && (
        <div className="rounded-2xl border border-border bg-background p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current pot balance</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatNaira(currentBalance)}</p>
        </div>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Loading ledger…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted">No ledger entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Entry</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Balance after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-muted">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ENTRY_TONE[entry.entryType]}>{formatEnumLabel(entry.entryType)}</Badge>
                  </td>
                  <td className={`px-4 py-3 font-medium ${entry.amount < 0 ? "text-danger" : "text-success"}`}>
                    {entry.amount < 0 ? "−" : "+"}
                    {formatNaira(Math.abs(entry.amount))}
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatNaira(entry.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
