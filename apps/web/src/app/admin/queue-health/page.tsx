"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { getQueueHealth } from "@/lib/api/admin/queueHealth";
import { Badge } from "@/components/ui/Badge";
import type { LevelQueueHealth } from "@/types/api";

export default function AdminQueueHealthPage() {
  const { accessToken } = useAuth();
  const [levels, setLevels] = useState<LevelQueueHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getQueueHealth(accessToken);
        if (!cancelled) {
          setLevels(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load queue health.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Queue Health</h1>
        <p className="mt-1 text-sm text-muted">
          Wait times and stalled entries per level. A stalled entry has waited longer than that
          level&apos;s configured threshold with no match — a candidate for manual matching.
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Loading queue health…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {levels.map((level) => (
            <div key={level.levelId} className="rounded-2xl border border-border bg-background p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-foreground">{level.levelName}</p>
                <div className="flex gap-2">
                  <Badge tone={level.isActive ? "success" : "neutral"}>
                    {level.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {level.stalledCount > 0 ? (
                    <Badge tone="danger">{level.stalledCount} stalled</Badge>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Waiting</p>
                  <p className="mt-1 text-foreground">{level.waitingCount}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Oldest wait</p>
                  <p className="mt-1 text-foreground">
                    {level.oldestWaitingAgeDays === null ? "—" : `${level.oldestWaitingAgeDays}d`}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Stalled threshold</p>
                  <p className="mt-1 text-foreground">{level.stalledThresholdDays}d</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Avg. completion</p>
                  <p className="mt-1 text-foreground">
                    {level.avgCompletionDays === null ? "—" : `${level.avgCompletionDays}d`}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Completed cycles</p>
                  <p className="mt-1 text-foreground">{level.completedCount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
