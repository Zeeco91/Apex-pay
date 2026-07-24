"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { getMyConversation, listMyMessages, markMyConversationRead, sendMyMessage } from "@/lib/api/chat";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { SupportConversationView, SupportMessageView } from "@/types/api";

const MESSAGE_POLL_MS = 4_000;

export default function DashboardSupportPage() {
  const { accessToken } = useAuth();
  const [conversation, setConversation] = useState<SupportConversationView | null>(null);
  const [messages, setMessages] = useState<SupportMessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshMessages = useCallback(async () => {
    if (!accessToken) return;
    const [conv, msgs] = await Promise.all([getMyConversation(accessToken), listMyMessages(accessToken)]);
    setConversation(conv);
    setMessages(msgs);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        await refreshMessages();
        await markMyConversationRead(accessToken);
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load your conversation.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    const interval = setInterval(() => {
      refreshMessages()
        .then(() => markMyConversationRead(accessToken))
        .catch(() => {
          // Non-critical — next tick retries.
        });
    }, MESSAGE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, refreshMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !accessToken || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const result = await sendMyMessage(accessToken, body);
      setMessages((prev) => [...prev, result.message]);
      setConversation(result.conversation);
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Support</h1>
          {conversation?.status === "RESOLVED" && <Badge tone="success">Resolved</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">Message our team directly — we&apos;ll reply here.</p>
      </div>

      <div className="flex h-[32rem] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div ref={scrollRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
          {isLoading && messages.length === 0 ? (
            <p className="text-sm text-muted">Loading your conversation…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted">Send us a message and our support team will get back to you here.</p>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.senderRole === "USER"}
                otherPartyLabel="Support"
              />
            ))
          )}
        </div>

        {error && (
          <p role="alert" className="px-4 text-sm text-danger">
            {error}
          </p>
        )}

        <form onSubmit={(event) => void handleSend(event)} className="flex items-center gap-2 border-t border-border p-4">
          <label htmlFor="support-message-input" className="sr-only">
            Message
          </label>
          <input
            id="support-message-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your message…"
            maxLength={2000}
            className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <Button type="submit" className="px-5 py-2.5 text-sm" isLoading={isSending} disabled={!draft.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
