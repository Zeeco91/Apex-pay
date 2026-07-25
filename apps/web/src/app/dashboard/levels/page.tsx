"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getLevels } from "@/lib/api/levels";
import { cancelQueueEntry, joinQueue, listMyQueueEntries } from "@/lib/api/queue";
import { ApiError } from "@/lib/api/client";
import { formatNaira } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { TransactionPanel } from "@/components/dashboard/TransactionPanel";
import type { PublicLevel, QueueEntryStatus, QueueEntrySummary } from "@/types/api";

const ACTIVE_STATUSES: QueueEntryStatus[] = [
  "PENDING_JOIN_PAYMENT",
  "WAITING_FOR_PAYOUT",
  "MATCHED_AS_PAYEE",
];

export default function DashboardLevelsPage() {
  const { accessToken } = useAuth();
  const [levels, setLevels] = useState<PublicLevel[] | null>(null);
  // Members can only be in one level's payout queue at a time, so there's at most one active
  // entry, regardless of which level it's in — while it exists, every other level is hidden.
  const [activeEntry, setActiveEntry] = useState<QueueEntrySummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joiningLevelId, setJoiningLevelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadActiveEntry = useCallback(async () => {
    if (!accessToken) return;
    try {
      const entries = await listMyQueueEntries(accessToken);
      setActiveEntry(entries.find((entry) => ACTIVE_STATUSES.includes(entry.status)) ?? null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load your levels. Please try again.");
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    Promise.all([getLevels(), listMyQueueEntries(accessToken)])
      .then(([levelsData, entriesData]) => {
        if (cancelled) return;
        setLevels(levelsData);
        setActiveEntry(entriesData.find((entry) => ACTIVE_STATUSES.includes(entry.status)) ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Couldn't load levels. Please try again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleJoin(levelId: string) {
    if (!accessToken) return;
    setJoiningLevelId(levelId);
    setActionError(null);

    try {
      const result = await joinQueue(accessToken, levelId);
      setActiveEntry(result.entry);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't join this level. Please try again.");
    } finally {
      setJoiningLevelId(null);
    }
  }

  async function handleCancel() {
    if (!accessToken || !activeEntry) return;
    setIsCancelling(true);
    setActionError(null);

    try {
      await cancelQueueEntry(accessToken, activeEntry.id);
      setActiveEntry(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't cancel. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  const needsPayment = activeEntry?.status === "PENDING_JOIN_PAYMENT" && Boolean(activeEntry.transactionId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Provide help</h1>
        <p className="mt-1 text-sm text-muted">
          Joining matches you FIFO with the oldest member waiting in that level.{" "}
          <Link href="/dashboard/queue" className="font-medium text-primary underline underline-offset-4">
            Get help →
          </Link>
        </p>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {loadError}
        </div>
      ) : levels === null ? (
        <LevelsSkeleton />
      ) : activeEntry ? (
        <div className="max-w-xl rounded-2xl border border-border bg-background p-6 shadow-sm">
          <span className="text-sm font-semibold uppercase tracking-wide text-muted">{activeEntry.levelName}</span>
          <span className="mt-2 block text-3xl font-bold text-foreground">
            {formatNaira(activeEntry.contributionAmount)}
          </span>

          {needsPayment ? (
            <div className="mt-6 flex flex-col gap-4">
              <TransactionPanel
                transactionId={activeEntry.transactionId!}
                onEntryStatusChange={() => void loadActiveEntry()}
              />
              <Button
                type="button"
                variant="outline"
                isLoading={isCancelling}
                onClick={() => void handleCancel()}
                className="self-start"
              >
                {isCancelling ? "Cancelling…" : "Cancel and join another level"}
              </Button>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium text-foreground">
                Nothing to pay right now for this level.
              </div>
              <Link
                href="/dashboard/queue"
                className="text-center text-sm font-medium text-primary underline underline-offset-4"
              >
                Check Get Help →
              </Link>
            </div>
          )}

          {actionError && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {actionError}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map((level) => {
            const isJoining = joiningLevelId === level.id;

            return (
              <div
                key={level.id}
                className="flex flex-col rounded-2xl border border-border bg-background p-6 shadow-sm"
              >
                <span className="text-sm font-semibold uppercase tracking-wide text-muted">{level.name}</span>
                <span className="mt-2 text-3xl font-bold text-foreground">
                  {formatNaira(level.contributionAmount)}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-6 w-full"
                  isLoading={isJoining}
                  onClick={() => void handleJoin(level.id)}
                >
                  {isJoining ? "Joining…" : "Join"}
                </Button>
              </div>
            );
          })}
          {actionError && (
            <p role="alert" className="text-sm text-danger sm:col-span-2 lg:col-span-3">
              {actionError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LevelsSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading levels">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-48 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}
