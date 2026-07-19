import { apiFetch } from "../client";
import type { LevelQueueHealth } from "@/types/api";

export async function getQueueHealth(accessToken: string): Promise<LevelQueueHealth[]> {
  const res = await apiFetch<{ success: true; data: LevelQueueHealth[] }>(
    "/admin/queue-health",
    { accessToken },
  );
  return res.data;
}
