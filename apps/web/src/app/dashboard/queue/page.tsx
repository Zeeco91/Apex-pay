"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { cancelQueueEntry, listMyQueueEntries } from "@/lib/api/queue";
import { getLevelQueueStats } from "@/lib/api/levels";
import { ApiError } from "@/lib/api/client";
import { formatNaira } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { TransactionPanel } from "@/components/dashboard/TransactionPanel";
import type { QueueEntryStatus, QueueEntrySummary } from "@/types/api";

const ACTIVE_STATUSES: QueueEntryStatus[] = [
  "PENDING_JOIN_PAYMENT",
  "WAITING_FOR_PAYOUT",
  "MATCHED_AS_PAYEE",
];

export default function DashboardQueuePage() {
  const { accessToken } = useAuth();
  const [entry, setEntry] = useState<QueueEntrySummary | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadEntry = useCallback(async () => {
    if (!accessToken) return;
    const entries = await listMyQueueEntries(accessToken);
    const active = entries.find((e) => ACTIVE_STATUSES.includes(e.status)) ?? null;
    setEntry(active);

    if (active?.status === "WAITING_FOR_PAYOUT") {
      try {
        const stats = await getLevelQueueStats(accessToken, active.levelId);
        setPosition(stats.yourEntry?.position ?? null);
      } catch {
        // Position is a nice-to-have — the panel still renders without it.
      }
    } else {
      setPosition(null);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        await loadEntry();
        if (!cancelled) setLoadError(null);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Couldn't load your entry. Please try again.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, loadEntry]);

  async function handleCancel() {
    if (!accessToken || !entry) return;
    setIsCancelling(true);
    setActionError(null);
    try {
      await cancelQueueEntry(accessToken, entry.id);
      setEntry(null);
      setPosition(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't cancel this entry. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  // Matching itself happens automatically (FIFO, as soon as someone else joins the level) —
  // this button just checks your status right now instead of waiting for the next auto-refresh.
  async function handleCheckForMatch() {
    if (!accessToken) return;
    const statusBeforeCheck = entry?.status;
    setIsChecking(true);
    setCheckMessage(null);
    setActionError(null);
    try {
      await loadEntry();
      if (statusBeforeCheck === "WAITING_FOR_PAYOUT") {
        setCheckMessage("Still waiting — you'll be matched as soon as it's your turn.");
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't check your status. Please try again.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Get help</h1>
        <p className="mt-1 text-sm text-muted">
          Once someone joins behind you, you&apos;ll be matched here with the person paying you.
        </p>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {loadError}
        </div>
      ) : isLoading ? (
        <div className="h-48 max-w-xl animate-pulse rounded-2xl border border-border bg-surface" aria-busy="true" />
      ) : !entry ? (
        <EmptyState />
      ) : entry.status === "PENDING_JOIN_PAYMENT" ? (
        <div className="max-w-xl rounded-2xl border border-border bg-background p-6 text-center shadow-sm">
          <p className="text-sm text-muted">
            Finish your payment for {entry.levelName} under{" "}
            <Link href="/dashboard/levels" className="font-medium text-primary underline underline-offset-4">
              Provide Help
            </Link>{" "}
            before you can be matched to get paid.
          </p>
        </div>
      ) : (
        <div className="max-w-xl rounded-2xl border border-border bg-background p-6 shadow-sm">
          <span className="text-sm font-semibold uppercase tracking-wide text-muted">{entry.levelName}</span>
          <span className="mt-2 block text-3xl font-bold text-foreground">
            {formatNaira(entry.contributionAmount)}
          </span>

          {entry.status === "MATCHED_AS_PAYEE" && entry.transactionId ? (
            <div className="mt-6">
              <TransactionPanel transactionId={entry.transactionId} onEntryStatusChange={() => void loadEntry()} />
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium text-foreground">
                {position ? `You're #${position} in line` : "Waiting for a match"}
              </div>
              <Button
                type="button"
                isLoading={isChecking}
                onClick={() => void handleCheckForMatch()}
                className="self-start"
              >
                {isChecking ? "Checking…" : "Get matched to be paid"}
              </Button>
              {checkMessage && <p className="text-sm text-muted">{checkMessage}</p>}
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={isCancelling}
                className="self-start text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground disabled:opacity-50"
              >
                {isCancelling ? "Cancelling…" : "Cancel"}
              </button>
            </div>
          )}

          {actionError && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {actionError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="max-w-xl rounded-2xl border border-border bg-background p-10 text-center">
      <p className="text-base font-semibold text-foreground">Nothing to show yet</p>
      <p className="mt-2 text-sm text-muted">
        Head over to{" "}
        <Link href="/dashboard/levels" className="font-medium text-primary underline underline-offset-4">
          Provide Help
        </Link>{" "}
        to join a level — you&apos;ll show up here once it&apos;s your turn to get paid.
      </p>
    </div>
  );
}
