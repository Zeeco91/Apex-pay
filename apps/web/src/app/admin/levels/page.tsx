"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { listLevelsForAdmin, updateLevel, type UpdateLevelPayload } from "@/lib/api/admin/levels";
import { LevelEditCard } from "@/components/admin/LevelEditCard";
import type { AdminLevel } from "@/types/api";

export default function AdminLevelsPage() {
  const { accessToken } = useAuth();
  const [levels, setLevels] = useState<AdminLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await listLevelsForAdmin(accessToken);
        if (!cancelled) {
          setLevels(data.sort((a, b) => a.sortOrder - b.sortOrder));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load levels.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleSave(levelId: string, payload: UpdateLevelPayload) {
    if (!accessToken) return;
    const updated = await updateLevel(accessToken, levelId, payload);
    setLevels((prev) => prev.map((l) => (l.id === levelId ? updated : l)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Levels</h1>
        <p className="mt-1 text-sm text-muted">
          Changes apply to new queue joins and future disbursements only — they never retroactively change
          transactions already in flight.
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Loading levels…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {levels.map((level) => (
            <LevelEditCard key={level.id} level={level} onSave={(payload) => handleSave(level.id, payload)} />
          ))}
        </div>
      )}
    </div>
  );
}
