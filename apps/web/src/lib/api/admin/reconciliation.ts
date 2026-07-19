import { apiFetch } from "../client";
import type { ReconciliationRunView } from "@/types/api";

export async function listReconciliationRuns(
  accessToken: string,
  limit?: number,
): Promise<ReconciliationRunView[]> {
  const res = await apiFetch<{ success: true; data: ReconciliationRunView[] }>(
    `/admin/reconciliation-runs${limit ? `?limit=${limit}` : ""}`,
    { accessToken },
  );
  return res.data;
}

export async function runReconciliationNow(
  accessToken: string,
): Promise<ReconciliationRunView> {
  const res = await apiFetch<{ success: true; data: ReconciliationRunView }>(
    "/admin/reconciliation-runs/run",
    { method: "POST", accessToken },
  );
  return res.data;
}
