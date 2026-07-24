"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getLevels } from "@/lib/api/levels";
import { joinQueue, listMyQueueEntries } from "@/lib/api/queue";
import { ApiError } from "@/lib/api/client";
import { formatNaira } from "@/lib/constants";
import { describeQueueEntryStatus } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import type { PublicLevel, QueueEntryStatus, QueueEntrySummary } from "@/types/api";

const ACTIVE_STATUSES: QueueEntryStatus[] = [
  "PENDING_JOIN_PAYMENT",
  "WAITING_FOR_PAYOUT",
  "MATCHED_AS_PAYEE",
];

export default function DashboardLevelsPage() {
  const { accessToken } = useAuth();
  const [levels, setLevels] = useState<PublicLevel[] | null>(null);
  const [entriesByLevel, setEntriesByLevel] = useState<Record<string, QueueEntrySummary>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joiningLevelId, setJoiningLevelId] = useState<string | null>(null);
  const [joinErrorsByLevel, setJoinErrorsByLevel] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    Promise.all([getLevels(), listMyQueueEntries(accessToken)])
      .then(([levelsData, entriesData]) => {
        if (cancelled) return;
        setLevels(levelsData);
        setEntriesByLevel(indexActiveEntriesByLevel(entriesData));
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
    setJoinErrorsByLevel((prev) => ({ ...prev, [levelId]: "" }));

    try {
      const result = await joinQueue(accessToken, levelId);
      setEntriesByLevel((prev) => ({ ...prev, [levelId]: result.entry }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't join this level. Please try again.";
      setJoinErrorsByLevel((prev) => ({ ...prev, [levelId]: message }));
    } finally {
      setJoiningLevelId(null);
    }
  }

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
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map((level) => {
            const activeEntry = entriesByLevel[level.id];
            const isJoining = joiningLevelId === level.id;
            const joinError = joinErrorsByLevel[level.id];

            return (
              <div
                key={level.id}
                className="flex flex-col rounded-2xl border border-border bg-background p-6 shadow-sm"
              >
                <span className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {level.name}
                </span>
                <span className="mt-2 text-3xl font-bold text-foreground">
                  {formatNaira(level.contributionAmount)}
                </span>

                {activeEntry ? (
                  <div className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium text-foreground">
                    {describeQueueEntryStatus(activeEntry.status)}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-6 w-full"
                    isLoading={isJoining}
                    onClick={() => void handleJoin(level.id)}
                  >
                    {isJoining ? "Joining…" : "Join"}
                  </Button>
                )}
                {joinError && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    {joinError}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function indexActiveEntriesByLevel(
  entries: QueueEntrySummary[],
): Record<string, QueueEntrySummary> {
  const map: Record<string, QueueEntrySummary> = {};
  for (const entry of entries) {
    if (ACTIVE_STATUSES.includes(entry.status)) {
      map[entry.levelId] = entry;
    }
  }
  return map;
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
