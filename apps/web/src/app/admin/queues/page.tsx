"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { getLevels } from "@/lib/api/levels";
import {
  listQueueForLevel,
  manualMatch,
  adminCancelEntry,
  holdQueueEntry,
  releaseQueueEntry,
  getAutoMatchStatus,
  setAutoMatchStatus,
  getHelpActionsStatus,
  setHelpActionsStatus,
} from "@/lib/api/admin/queue";
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

// Admin-facing phrasing for queue status, distinct from the member-facing copy in lib/format.ts.
const ADMIN_STATUS_LABELS: Record<QueueEntryStatus, string> = {
  PENDING_JOIN_PAYMENT: "Waiting to pay",
  WAITING_FOR_PAYOUT: "Paid and waiting to be paid",
  MATCHED_AS_PAYEE: "Matched as payee",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  ADMIN_HOLD: "On hold",
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

  const [autoMatchEnabled, setAutoMatchEnabled] = useState<boolean | null>(null);
  const [isTogglingAutoMatch, setIsTogglingAutoMatch] = useState(false);
  const [autoMatchError, setAutoMatchError] = useState<string | null>(null);

  const [helpActionsEnabled, setHelpActionsEnabled] = useState<boolean | null>(null);
  const [isTogglingHelpActions, setIsTogglingHelpActions] = useState(false);
  const [helpActionsError, setHelpActionsError] = useState<string | null>(null);

  useEffect(() => {
    getLevels()
      .then((data) => {
        setLevels(data);
        if (data.length > 0) setLevelId(data[0].id);
      })
      .catch(() => setError("Failed to load levels."));
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    getAutoMatchStatus(accessToken)
      .then((enabled) => setAutoMatchEnabled(enabled))
      .catch((err) => setAutoMatchError(err instanceof ApiError ? err.message : "Failed to load auto-match status."));
  }, [accessToken]);

  async function handleToggleAutoMatch() {
    if (!accessToken || autoMatchEnabled === null) return;
    const next = !autoMatchEnabled;
    setIsTogglingAutoMatch(true);
    setAutoMatchError(null);
    try {
      const enabled = await setAutoMatchStatus(accessToken, next);
      setAutoMatchEnabled(enabled);
    } catch (err) {
      setAutoMatchError(err instanceof ApiError ? err.message : "Failed to update auto-match status.");
    } finally {
      setIsTogglingAutoMatch(false);
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    getHelpActionsStatus(accessToken)
      .then((enabled) => setHelpActionsEnabled(enabled))
      .catch((err) => setHelpActionsError(err instanceof ApiError ? err.message : "Failed to load launch status."));
  }, [accessToken]);

  async function handleToggleHelpActions() {
    if (!accessToken || helpActionsEnabled === null) return;
    const next = !helpActionsEnabled;
    setIsTogglingHelpActions(true);
    setHelpActionsError(null);
    try {
      const enabled = await setHelpActionsStatus(accessToken, next);
      setHelpActionsEnabled(enabled);
    } catch (err) {
      setHelpActionsError(err instanceof ApiError ? err.message : "Failed to update launch status.");
    } finally {
      setIsTogglingHelpActions(false);
    }
  }

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

  async function handleAdminCancel(entryId: string, reason: string) {
    if (!accessToken) return;
    await adminCancelEntry(accessToken, entryId, reason);
    // A cancelled match can change the status of both matched parties at once,
    // so refetch the whole queue instead of patching a single row locally.
    await refreshEntries();
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

      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
          helpActionsEnabled === false ? "border-warning/40 bg-warning/5" : "border-border bg-background"
        }`}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Platform launch</p>
          <p className="mt-1 text-xs text-muted">
            {helpActionsEnabled === null
              ? "Loading…"
              : helpActionsEnabled
                ? "Live — members can use Provide Help and Get Help."
                : "On hold — members can register and browse, but can't join a queue yet."}
          </p>
        </div>
        <Button
          type="button"
          variant={helpActionsEnabled ? "outline" : "primary"}
          isLoading={isTogglingHelpActions}
          disabled={helpActionsEnabled === null}
          onClick={() => void handleToggleHelpActions()}
          className="self-start sm:self-auto"
        >
          {helpActionsEnabled ? "Put back on hold" : "Launch now"}
        </Button>
      </div>
      {helpActionsError ? <p className="text-sm text-danger">{helpActionsError}</p> : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Automatic matching</p>
          <p className="mt-1 text-xs text-muted">
            {autoMatchEnabled === null
              ? "Loading…"
              : autoMatchEnabled
                ? "On: new joins are matched automatically across every level."
                : "Off: new joins wait for you to match them manually. Manual matching still works as normal."}
          </p>
        </div>
        <Button
          type="button"
          variant={autoMatchEnabled ? "outline" : "primary"}
          isLoading={isTogglingAutoMatch}
          disabled={autoMatchEnabled === null}
          onClick={() => void handleToggleAutoMatch()}
          className="self-start sm:self-auto"
        >
          {autoMatchEnabled ? "Turn off automatic matching" : "Turn on automatic matching"}
        </Button>
      </div>
      {autoMatchError ? <p className="text-sm text-danger">{autoMatchError}</p> : null}

      <select
        aria-label="Select level"
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
                <th className="px-4 py-3 font-semibold">Payments</th>
                <th className="px-4 py-3 font-semibold">Waiting since</th>
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
                    <Badge tone={STATUS_TONE[entry.status]}>{ADMIN_STATUS_LABELS[entry.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {entry.payersConfirmedCount} / {entry.payersRequired}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {entry.status === "WAITING_FOR_PAYOUT" ? new Date(entry.waitingSince).toLocaleString() : "—"}
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
                      <div className="flex flex-wrap gap-2">
                        <ReasonActionButton
                          label="Hold"
                          reasonLabel="Hold reason"
                          confirmLabel="Hold"
                          onConfirm={(reason) => handleHold(entry.id, reason)}
                        />
                        <ReasonActionButton
                          label="Cancel match"
                          variant="outline"
                          reasonLabel="Reason for cancelling"
                          confirmLabel="Cancel match"
                          onConfirm={(reason) => handleAdminCancel(entry.id, reason)}
                        />
                      </div>
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
