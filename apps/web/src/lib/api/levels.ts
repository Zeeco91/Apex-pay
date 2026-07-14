import { apiFetch } from "./client";
import type { LevelQueueStats, PublicLevel } from "@/types/api";

export async function getLevels(): Promise<PublicLevel[]> {
  const res = await apiFetch<{ success: true; data: PublicLevel[] }>("/levels");
  return res.data;
}

export async function getLevelQueueStats(
  accessToken: string,
  levelId: string,
): Promise<LevelQueueStats> {
  const res = await apiFetch<{ success: true; data: LevelQueueStats }>(
    `/levels/${levelId}/queue-stats`,
    { accessToken },
  );
  return res.data;
}
