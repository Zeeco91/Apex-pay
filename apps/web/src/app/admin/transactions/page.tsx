"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { formatNaira } from "@/lib/constants";
import { listTransactionsForAdmin, resolveDispute } from "@/lib/api/admin/transactions";
import { describeTransactionStatus } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DisputeResolutionAction } from "@/components/admin/DisputeResolutionAction";
import type { AdminTransactionSummary, TransactionStatus } from "@/types/api";

const STATUS_TONE: Record<TransactionStatus, BadgeTone> = {
  AWAITING_PAYER_PROOF: "neutral",
  PROOF_SUBMITTED: "warning",
  PRINCIPAL_RECEIVED: "info",
  PENDING_DISBURSEMENT: "warning",
  DISBURSED: "info",
  CONFIRMED: "success",
  DISPUTED: "danger",
  ADMIN_RESOLVED_CONFIRMED: "success",
  ADMIN_RESOLVED_REJECTED: "danger",
  CANCELLED: "neutral",
};

const FILTERS: { label: string; value: TransactionStatus | "" }[] = [
  { label: "Awaiting payment", value: "AWAITING_PAYER_PROOF" },
  { label: "Awaiting payee confirmation", value: "PROOF_SUBMITTED" },
  { label: "Disputed", value: "DISPUTED" },
  { label: "All", value: "" },
];

export default function AdminTransactionsPage() {
  const { accessToken } = useAuth();
  const [transactions, setTransactions] = useState<AdminTransactionSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "">("PROOF_SUBMITTED");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await listTransactionsForAdmin(accessToken, statusFilter || undefined);
        if (!cancelled) {
          setTransactions(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load transactions.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, statusFilter]);

  async function handleResolveDispute(id: string, resolution: "CONFIRMED" | "REJECTED", notes: string) {
    if (!accessToken) return;
    const updated = await resolveDispute(accessToken, id, { resolution, notes });
    setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Transactions</h1>
        <p className="mt-1 text-sm text-muted">
          Members pay each other directly — resolve disputes when something goes wrong.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            onClick={() => setStatusFilter(filter.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === filter.value
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Loading transactions…</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted">No transactions match this filter.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {transactions.map((tx) => (
            <div key={tx.id} className="rounded-2xl border border-border bg-background p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">
                    {tx.levelName} · {formatNaira(tx.principalAmount)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Payer: {tx.payer.fullName} ({tx.payer.phone}) → Payee: {tx.payee.fullName} ({tx.payee.phone})
                  </p>
                </div>
                <Badge tone={STATUS_TONE[tx.status]}>{describeTransactionStatus(tx.status)}</Badge>
              </div>

              <div className="mt-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Match type</p>
                <p className="mt-1 text-foreground">{tx.matchType.replace(/_/g, " ")}</p>
              </div>

              {tx.disputeReason ? (
                <p className="mt-4 text-sm text-danger">Dispute: {tx.disputeReason}</p>
              ) : null}

              {tx.status === "DISPUTED" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <DisputeResolutionAction
                    onConfirm={(resolution, notes) => handleResolveDispute(tx.id, resolution, notes)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
