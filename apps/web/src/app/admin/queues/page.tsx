"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { getLevels } from "@/lib/api/levels";
import { listQueueForLevel, manualMatch, holdQueueEntry, releaseQueueEntry } from "@/lib/api/admin/queue";
import { formatEnumLabel } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ReasonActionButton } from "@/components/admin/ReasonActionButton";
import type { AdminQueueEntryView, PublicLevel, QueueEntryStatus } from "@/types/api";

const STATUS_TONE: Record<QueueEntryStatus, BadgeTone> = {
  PENDING_JOIN_PAYMENT: "info",
  WAITING_FOR_PAYOUT: "neutral",
  MATCHED_AS_PAYEE: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
  ADMIN_HOLD: "danger",
};

const MANUAL_MATCH_ELIGIBLE: QueueEntryStatus[] = ["WAITING_FOR_PAYOUT"];
const HOLDABLE_STATUSES: QueueEntryStatus[] = [
  "PENDING_JOIN_PAYMENT",
  "WAITING_FOR_PAYOUT",
  "MATCHED_AS_PAYEE",
];

export default function AdminQueuesPage() {
  const { accessToken } = useAuth();
  const [levels, setLevels] = useState<PublicLevel[]>([]);
  const [levelId, setLevelId] = useState<string>("");
  const [entries, setEntries] = useState<AdminQueueEntryView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payerId, setPayerId] = useState<string | null>(null);
  const [payeeId, setPayeeId] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  useEffect(() => {
    getLevels()
      .then((data) => {
        setLevels(data);
        if (data.length > 0) setLevelId(data[0].id);
      })
      .catch(() => setError("Failed to load levels."));
  }, []);

  useEffect(() => {
    if (!accessToken || !levelId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await listQueueForLevel(accessToken, levelId);
        if (!cancelled) {
          setEntries(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load the queue.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, levelId]);

  async function refreshEntries() {
    if (!accessToken || !levelId) return;
    try {
      const data = await listQueueForLevel(accessToken, levelId);
      setEntries(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reload the queue.");
    }
  }

  async function handleHold(entryId: string, reason: string) {
    if (!accessToken) return;
    const updated = await holdQueueEntry(accessToken, entryId, reason);
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: updated.status } : e)));
  }

  async function handleRelease(entryId: string, reason: string) {
    if (!accessToken) return;
    const updated = await releaseQueueEntry(accessToken, entryId, reason || undefined);
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: updated.status } : e)));
  }

  async function handleManualMatch(reason: string) {
    if (!accessToken || !payerId || !payeeId) return;
    setMatchError(null);
    try {
      await manualMatch(accessToken, levelId, { payerEntryId: payerId, payeeEntryId: payeeId, reason });
      setPayerId(null);
      setPayeeId(null);
      await refreshEntries();
    } catch (err) {
      setMatchError(err instanceof ApiError ? err.message : "Manual match failed.");
      throw err;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Queues</h1>
        <p className="mt-1 text-sm text-muted">
          Select two members waiting for payout to force a match, or place an entry on hold.
        </p>
      </div>

      <select
        value={levelId}
        onChange={(e) => {
          setLevelId(e.target.value);
          setPayerId(null);
          setPayeeId(null);
        }}
        className="w-fit rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
      >
        {levels.map((level) => (
          <option key={level.id} value={level.id}>
            {level.name}
          </option>
        ))}
      </select>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {(payerId || payeeId) && (
        <div className="rounded-2xl border border-primary bg-background p-4">
          <p className="text-sm font-semibold text-foreground">Manual match</p>
          <p className="mt-1 text-sm text-muted">
            Payer: {payerId ? entries.find((e) => e.id === payerId)?.userFullName ?? payerId : "not selected"} · Payee:{" "}
            {payeeId ? entries.find((e) => e.id === payeeId)?.userFullName ?? payeeId : "not selected"}
          </p>
          {matchError ? <p className="mt-2 text-sm text-danger">{matchError}</p> : null}
          <div className="mt-3">
            {payerId && payeeId ? (
              <ReasonActionButton
                label="Prepare match"
                variant="primary"
                reasonLabel="Reason for manual match"
                confirmLabel="Confirm match"
                onConfirm={handleManualMatch}
              />
            ) : (
              <p className="text-xs text-muted">Select one payer and one payee below.</p>
            )}
            <Button
              variant="outline"
              className="ml-2 px-4 py-2 text-xs"
              onClick={() => {
                setPayerId(null);
                setPayeeId(null);
              }}
            >
              Clear selection
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted">Loading queue…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted">No entries in this level&apos;s queue yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Manual match</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-muted">{entry.queueSequence}</td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{entry.userFullName}</p>
                    <p className="text-xs text-muted">{entry.userPhone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[entry.status]}>{formatEnumLabel(entry.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(entry.joinedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {MANUAL_MATCH_ELIGIBLE.includes(entry.status) ? (
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setPayerId(payerId === entry.id ? null : entry.id)}
                          className={`rounded-full border px-3 py-1 ${
                            payerId === entry.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
                          }`}
                        >
                          Payer
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayeeId(payeeId === entry.id ? null : entry.id)}
                          className={`rounded-full border px-3 py-1 ${
                            payeeId === entry.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
                          }`}
                        >
                          Payee
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {entry.status === "ADMIN_HOLD" ? (
                      <ReasonActionButton
                        label="Release"
                        reasonRequired={false}
                        reasonLabel="Release note"
                        confirmLabel="Release"
                        onConfirm={(reason) => handleRelease(entry.id, reason)}
                      />
                    ) : HOLDABLE_STATUSES.includes(entry.status) ? (
                      <ReasonActionButton
                        label="Hold"
                        reasonLabel="Hold reason"
                        confirmLabel="Hold"
                        onConfirm={(reason) => handleHold(entry.id, reason)}
                      />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
