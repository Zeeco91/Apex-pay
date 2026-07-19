import { apiFetch } from "../client";
import type {
  AdminSupportConversationPage,
  AdminSupportConversationView,
  SupportConversationStatus,
  SupportMessageView,
} from "@/types/api";

export interface AdminConversationFilters {
  status?: SupportConversationStatus;
  search?: string;
  take?: number;
  skip?: number;
}

export async function listConversations(
  accessToken: string,
  filters: AdminConversationFilters = {},
): Promise<AdminSupportConversationPage> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.take) params.set("take", String(filters.take));
  if (filters.skip) params.set("skip", String(filters.skip));
  const query = params.toString();
  const res = await apiFetch<{ success: true; data: AdminSupportConversationPage }>(
    `/admin/support/conversations${query ? `?${query}` : ""}`,
    { accessToken },
  );
  return res.data;
}

export async function listConversationMessages(
  accessToken: string,
  conversationId: string,
): Promise<SupportMessageView[]> {
  const res = await apiFetch<{ success: true; data: SupportMessageView[] }>(
    `/admin/support/conversations/${conversationId}/messages`,
    { accessToken },
  );
  return res.data;
}

export async function sendConversationMessage(
  accessToken: string,
  conversationId: string,
  body: string,
): Promise<{ message: SupportMessageView; conversation: AdminSupportConversationView }> {
  const res = await apiFetch<{
    success: true;
    data: { message: SupportMessageView; conversation: AdminSupportConversationView };
  }>(`/admin/support/conversations/${conversationId}/messages`, {
    method: "POST",
    accessToken,
    body: { body },
  });
  return res.data;
}

export async function markConversationRead(
  accessToken: string,
  conversationId: string,
): Promise<void> {
  await apiFetch<{ success: true }>(`/admin/support/conversations/${conversationId}/read`, {
    method: "POST",
    accessToken,
  });
}

export async function resolveConversation(
  accessToken: string,
  conversationId: string,
  reason?: string,
): Promise<AdminSupportConversationView> {
  const res = await apiFetch<{ success: true; data: AdminSupportConversationView }>(
    `/admin/support/conversations/${conversationId}/resolve`,
    { method: "POST", accessToken, body: { reason } },
  );
  return res.data;
}
