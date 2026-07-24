import { apiFetch } from "../client";
import type { AdminUserSummary, UserRole, UserStatus } from "@/types/api";

export async function listUsers(
  accessToken: string,
  filters: { status?: UserStatus; role?: UserRole; search?: string } = {},
): Promise<AdminUserSummary[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.role) params.set("role", filters.role);
  if (filters.search) params.set("search", filters.search);
  const query = params.toString();
  const res = await apiFetch<{ success: true; data: AdminUserSummary[] }>(
    `/admin/users${query ? `?${query}` : ""}`,
    { accessToken },
  );
  return res.data;
}

export async function suspendUser(
  accessToken: string,
  userId: string,
  reason: string,
): Promise<AdminUserSummary> {
  const res = await apiFetch<{ success: true; data: AdminUserSummary }>(
    `/admin/users/${userId}/suspend`,
    { method: "POST", accessToken, body: { reason } },
  );
  return res.data;
}

export async function banUser(
  accessToken: string,
  userId: string,
  reason: string,
): Promise<AdminUserSummary> {
  const res = await apiFetch<{ success: true; data: AdminUserSummary }>(
    `/admin/users/${userId}/ban`,
    { method: "POST", accessToken, body: { reason } },
  );
  return res.data;
}

export async function reinstateUser(
  accessToken: string,
  userId: string,
  reason?: string,
): Promise<AdminUserSummary> {
  const res = await apiFetch<{ success: true; data: AdminUserSummary }>(
    `/admin/users/${userId}/reinstate`,
    { method: "POST", accessToken, body: { reason } },
  );
  return res.data;
}
