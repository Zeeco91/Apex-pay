import { apiFetch } from "./client";
import type { SupportConversationView, SupportMessageView } from "@/types/api";

export async function getMyConversation(
  accessToken: string,
): Promise<SupportConversationView | null> {
  const res = await apiFetch<{ success: true; data: SupportConversationView | null }>(
    "/chat/conversation",
    { accessToken },
  );
  return res.data;
}

export async function listMyMessages(accessToken: string): Promise<SupportMessageView[]> {
  const res = await apiFetch<{ success: true; data: SupportMessageView[] }>(
    "/chat/conversation/messages",
    { accessToken },
  );
  return res.data;
}

export async function sendMyMessage(
  accessToken: string,
  body: string,
): Promise<{ message: SupportMessageView; conversation: SupportConversationView }> {
  const res = await apiFetch<{
    success: true;
    data: { message: SupportMessageView; conversation: SupportConversationView };
  }>("/chat/conversation/messages", { method: "POST", accessToken, body: { body } });
  return res.data;
}

export async function markMyConversationRead(accessToken: string): Promise<void> {
  await apiFetch<{ success: true }>("/chat/conversation/read", {
    method: "POST",
    accessToken,
  });
}
