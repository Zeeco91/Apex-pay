import { apiFetch } from "../client";
import type { AdminQueueEntryView, QueueEntrySummary } from "@/types/api";

export async function listQueueForLevel(
  accessToken: string,
  levelId: string,
): Promise<AdminQueueEntryView[]> {
  const res = await apiFetch<{ success: true; data: AdminQueueEntryView[] }>(
    `/admin/queues/${levelId}`,
    { accessToken },
  );
  return res.data;
}

export async function manualMatch(
  accessToken: string,
  levelId: string,
  params: { payerEntryId: string; payeeEntryId: string; reason: string },
): Promise<{ payerEntry: QueueEntrySummary; payeeEntry: QueueEntrySummary }> {
  const res = await apiFetch<{
    success: true;
    data: { payerEntry: QueueEntrySummary; payeeEntry: QueueEntrySummary };
  }>(`/admin/queues/${levelId}/match`, { method: "POST", accessToken, body: params });
  return res.data;
}

export async function holdQueueEntry(
  accessToken: string,
  entryId: string,
  reason: string,
): Promise<AdminQueueEntryView> {
  const res = await apiFetch<{ success: true; data: AdminQueueEntryView }>(
    `/admin/queue-entries/${entryId}/hold`,
    { method: "POST", accessToken, body: { reason } },
  );
  return res.data;
}

export async function releaseQueueEntry(
  accessToken: string,
  entryId: string,
  reason?: string,
): Promise<AdminQueueEntryView> {
  const res = await apiFetch<{ success: true; data: AdminQueueEntryView }>(
    `/admin/queue-entries/${entryId}/release`,
    { method: "POST", accessToken, body: { reason } },
  );
  return res.data;
}
