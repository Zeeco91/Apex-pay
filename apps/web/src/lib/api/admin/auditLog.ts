import { apiFetch } from "../client";
import type { AdminActionType, AuditLogPage } from "@/types/api";

export interface AuditLogFilters {
  targetEntityType?: string;
  adminUserId?: string;
  actionType?: AdminActionType;
  createdAtFrom?: string;
  createdAtTo?: string;
  take?: number;
  skip?: number;
}

export async function listAuditLog(
  accessToken: string,
  filters: AuditLogFilters = {},
): Promise<AuditLogPage> {
  const params = new URLSearchParams();
  if (filters.targetEntityType) params.set("targetEntityType", filters.targetEntityType);
  if (filters.adminUserId) params.set("adminUserId", filters.adminUserId);
  if (filters.actionType) params.set("actionType", filters.actionType);
  if (filters.createdAtFrom) params.set("createdAtFrom", filters.createdAtFrom);
  if (filters.createdAtTo) params.set("createdAtTo", filters.createdAtTo);
  if (filters.take) params.set("take", String(filters.take));
  if (filters.skip) params.set("skip", String(filters.skip));
  const query = params.toString();
  const res = await apiFetch<{ success: true; data: AuditLogPage }>(
    `/admin/audit-logs${query ? `?${query}` : ""}`,
    { accessToken },
  );
  return res.data;
}
