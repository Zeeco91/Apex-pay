"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { listKycRecords, approveKyc, rejectKyc } from "@/lib/api/admin/kyc";
import { formatEnumLabel } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ReasonActionButton } from "@/components/admin/ReasonActionButton";
import type { AdminKycRecordView, KycStatus } from "@/types/api";

const KYC_TONE: Record<KycStatus, BadgeTone> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  NOT_SUBMITTED: "neutral",
};

export default function AdminKycPage() {
  const { accessToken } = useAuth();
  const [records, setRecords] = useState<AdminKycRecordView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<KycStatus | "">("PENDING");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await listKycRecords(accessToken, statusFilter || undefined);
        if (!cancelled) {
          setRecords(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load KYC submissions.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, statusFilter]);

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApprove(id: string) {
    if (!accessToken) return;
    const updated = await approveKyc(accessToken, id);
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  async function handleReject(id: string, reason: string) {
    if (!accessToken) return;
    const updated = await rejectKyc(accessToken, id, reason);
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">KYC Review</h1>
        <p className="mt-1 text-sm text-muted">
          Identity numbers are decrypted only for display here and stay hidden until you choose to reveal them.
        </p>
      </div>

      <select
        aria-label="Filter by KYC status"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as KycStatus | "")}
        className="w-fit rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
      >
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
        <option value="">All</option>
      </select>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Loading submissions…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted">No submissions match this filter.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {records.map((record) => (
            <div key={record.id} className="rounded-2xl border border-border bg-background p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">{record.userFullName}</p>
                  <p className="text-sm text-muted">{record.userPhone}</p>
                </div>
                <Badge tone={KYC_TONE[record.status]}>{formatEnumLabel(record.status)}</Badge>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">ID Type</p>
                  <p className="mt-1 text-foreground">{record.idType}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">ID Number</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="font-mono text-foreground">
                      {revealedIds.has(record.id) ? record.idNumber : "•".repeat(record.idNumber.length)}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleReveal(record.id)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {revealedIds.has(record.id) ? "Hide" : "Reveal"}
                    </button>
                  </div>
                </div>
              </div>

              {record.rejectionReason ? (
                <p className="mt-4 text-sm text-danger">Rejected: {record.rejectionReason}</p>
              ) : null}

              {record.status === "PENDING" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="primary" className="px-4 py-2 text-xs" onClick={() => void handleApprove(record.id)}>
                    Approve
                  </Button>
                  <ReasonActionButton
                    label="Reject"
                    reasonLabel="Rejection reason"
                    confirmLabel="Reject"
                    onConfirm={(reason) => handleReject(record.id, reason)}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
