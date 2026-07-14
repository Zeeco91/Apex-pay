"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { cancelQueueEntry, listMyQueueEntries } from "@/lib/api/queue";
import { getLevelQueueStats } from "@/lib/api/levels";
import { ApiError } from "@/lib/api/client";
import { formatNaira } from "@/lib/constants";
import { describeQueueEntryStatus } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TransactionPanel } from "@/components/dashboard/TransactionPanel";
import type { QueueEntryStatus, QueueEntrySummary } from "@/types/api";

const STATUS_TONE: Record<QueueEntryStatus, BadgeTone> = {
  PENDING_JOIN_PAYMENT: "warning",
  WAITING_FOR_PAYOUT: "info",
  MATCHED_AS_PAYEE: "success",
  COMPLETED: "success",
  CANCELLED: "neutral",
  ADMIN_HOLD: "danger",
};

const CANCELLABLE_STATUSES: QueueEntryStatus[] = ["WAITING_FOR_PAYOUT", "PENDING_JOIN_PAYMENT"];

export default function DashboardQueuePage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<QueueEntrySummary[] | null>(null);
  const [positionsByEntryId, setPositionsByEntryId] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancellingEntryId, setCancellingEntryId] = useState<string | null>(null);
  const [cancelErrorsByEntry, setCancelErrorsByEntry] = useState<Record<string, string>>({});

  function applyLoadResult(
    result: { ok: true; entries: QueueEntrySummary[]; positions: Record<string, number> } | { ok: false; message: string },
  ) {
    if (result.ok) {
      setEntries(result.entries);
      setPositionsByEntryId(result.positions);
    } else {
      setLoadError(result.message);
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    loadEntries(accessToken).then((result) => {
      if (!cancelled) applyLoadResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // Used by TransactionPanel's onEntryStatusChange, which fires from an event handler
  // (confirm/dispute button clicks) — not an effect, so re-running the fetch here is fine.
  const refresh = useCallback(async () => {
    if (!accessToken) return;
    applyLoadResult(await loadEntries(accessToken));
  }, [accessToken]);

  async function handleCancel(entryId: string) {
    if (!accessToken) return;
    setCancellingEntryId(entryId);
    setCancelErrorsByEntry((prev) => ({ ...prev, [entryId]: "" }));

    try {
      const updated = await cancelQueueEntry(accessToken, entryId);
      setEntries((prev) => prev?.map((entry) => (entry.id === entryId ? updated : entry)) ?? null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't cancel this entry. Please try again.";
      setCancelErrorsByEntry((prev) => ({ ...prev, [entryId]: message }));
    } finally {
      setCancellingEntryId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My queue entries</h1>
        <p className="mt-1 text-sm text-muted">
          Every level you&apos;ve joined, past and present, with its current status.
        </p>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {loadError}
        </div>
      ) : entries === null ? (
        <EntriesSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => {
            const canCancel = CANCELLABLE_STATUSES.includes(entry.status);
            const isCancelling = cancellingEntryId === entry.id;
            const cancelError = cancelErrorsByEntry[entry.id];
            const position = positionsByEntryId[entry.id];

            return (
              <div key={entry.id} className="rounded-2xl border border-border bg-background p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold text-foreground">{entry.levelName}</span>
                      <Badge tone={STATUS_TONE[entry.status]}>{describeQueueEntryStatus(entry.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {formatNaira(entry.contributionAmount)}
                      {entry.status === "WAITING_FOR_PAYOUT" && position
                        ? ` — you're #${position} in line`
                        : ""}
                    </p>
                    {cancelError && (
                      <p role="alert" className="mt-2 text-sm text-danger">
                        {cancelError}
                      </p>
                    )}
                  </div>
                  {canCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      isLoading={isCancelling}
                      onClick={() => void handleCancel(entry.id)}
                      className="self-start sm:self-auto"
                    >
                      {isCancelling ? "Cancelling…" : "Cancel"}
                    </Button>
                  )}
                </div>

                {entry.transactionId && entry.status !== "CANCELLED" && (
                  <TransactionPanel
                    transactionId={entry.transactionId}
                    onEntryStatusChange={() => void refresh()}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function loadEntries(
  accessToken: string,
): Promise<
  | { ok: true; entries: QueueEntrySummary[]; positions: Record<string, number> }
  | { ok: false; message: string }
> {
  try {
    const entries = await listMyQueueEntries(accessToken);
    const waiting = entries.filter((entry) => entry.status === "WAITING_FOR_PAYOUT");

    const positions: Record<string, number> = {};
    await Promise.all(
      waiting.map(async (entry) => {
        try {
          const stats = await getLevelQueueStats(accessToken, entry.levelId);
          if (stats.yourEntry?.position) {
            positions[entry.id] = stats.yourEntry.position;
          }
        } catch {
          // Position is a nice-to-have — the entry list itself still renders without it.
        }
      }),
    );

    return { ok: true, entries, positions };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof ApiError ? err.message : "Couldn't load your queue entries. Please try again.",
    };
  }
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-background p-10 text-center">
      <p className="text-base font-semibold text-foreground">You haven&apos;t joined a level yet</p>
      <p className="mt-2 text-sm text-muted">
        Head over to Levels to join a savings tier and get matched into the queue.
      </p>
    </div>
  );
}

function EntriesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading queue entries">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}
