import { apiFetch } from "../client";
import type { AdminAuditLogEntry } from "@/types/api";

export async function listAuditLog(
  accessToken: string,
  filters: { targetEntityType?: string; adminUserId?: string } = {},
): Promise<AdminAuditLogEntry[]> {
  const params = new URLSearchParams();
  if (filters.targetEntityType) params.set("targetEntityType", filters.targetEntityType);
  if (filters.adminUserId) params.set("adminUserId", filters.adminUserId);
  const query = params.toString();
  const res = await apiFetch<{ success: true; data: AdminAuditLogEntry[] }>(
    `/admin/audit-logs${query ? `?${query}` : ""}`,
    { accessToken },
  );
  return res.data;
}
