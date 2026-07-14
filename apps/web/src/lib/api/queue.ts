import { apiFetch } from "./client";
import type { JoinQueueResult, QueueEntrySummary } from "@/types/api";

export async function joinQueue(accessToken: string, levelId: string): Promise<JoinQueueResult> {
  const res = await apiFetch<{ success: true; data: JoinQueueResult }>(
    `/levels/${levelId}/queue-entries`,
    { method: "POST", accessToken },
  );
  return res.data;
}

export async function listMyQueueEntries(accessToken: string): Promise<QueueEntrySummary[]> {
  const res = await apiFetch<{ success: true; data: QueueEntrySummary[] }>(
    "/users/me/queue-entries",
    { accessToken },
  );
  return res.data;
}

export async function cancelQueueEntry(
  accessToken: string,
  entryId: string,
): Promise<QueueEntrySummary> {
  const res = await apiFetch<{ success: true; data: QueueEntrySummary }>(
    `/queue-entries/${entryId}/cancel`,
    { method: "POST", accessToken },
  );
  return res.data;
}
