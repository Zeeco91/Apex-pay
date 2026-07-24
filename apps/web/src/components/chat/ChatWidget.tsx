"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { getMyConversation, listMyMessages, markMyConversationRead, sendMyMessage } from "@/lib/api/chat";
import { Button } from "@/components/ui/Button";
import { MessageBubble } from "./MessageBubble";
import type { SupportConversationView, SupportMessageView } from "@/types/api";

const CONVERSATION_POLL_MS = 15_000;
const MESSAGE_POLL_MS = 4_000;

export function ChatWidget() {
  const { status, user, accessToken } = useAuth();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<SupportConversationView | null>(null);
  const [messages, setMessages] = useState<SupportMessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isEligible =
    status === "authenticated" &&
    !!user &&
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN" &&
    !pathname.startsWith("/admin") &&
    // The dashboard has a dedicated full-page Support chat — avoid stacking the floating
    // widget on top of it.
    pathname !== "/dashboard/support";

  // Lightweight poll purely for the unread badge on the closed bubble.
  useEffect(() => {
    if (!isEligible || !accessToken || isOpen) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await getMyConversation(accessToken!);
        if (!cancelled) setConversation(data);
      } catch {
        // Non-critical — the badge just doesn't update this tick.
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), CONVERSATION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isEligible, accessToken, isOpen]);

  const refreshMessages = useCallback(async () => {
    if (!accessToken) return;
    const [conv, msgs] = await Promise.all([
      getMyConversation(accessToken),
      listMyMessages(accessToken),
    ]);
    setConversation(conv);
    setMessages(msgs);
  }, [accessToken]);

  // While open: poll for new messages and keep the conversation marked read.
  useEffect(() => {
    if (!isEligible || !accessToken || !isOpen) return;
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
  }, [isEligible, accessToken, isOpen, refreshMessages]);

  useEffect(() => {
    if (isOpen) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [isOpen, messages]);

  if (!isEligible) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen ? (
        <div
          className="flex h-[32rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          role="dialog"
          aria-label="Support chat"
        >
          <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3">
            <p className="text-sm font-semibold text-primary-foreground">Chat with support</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close support chat"
              className="rounded-full p-1 text-primary-foreground/80 hover:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
            {isLoading && messages.length === 0 ? (
              <p className="text-sm text-muted">Loading your conversation…</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted">
                Send us a message and our support team will get back to you here.
              </p>
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

          {error ? <p className="px-4 text-xs text-danger">{error}</p> : null}

          <form onSubmit={(e) => void handleSend(e)} className="flex items-center gap-2 border-t border-border p-3">
            <label htmlFor="chat-widget-input" className="sr-only">
              Message
            </label>
            <input
              id="chat-widget-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your message…"
              maxLength={2000}
              className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <Button
              type="submit"
              className="px-4 py-2 text-xs"
              isLoading={isSending}
              disabled={!draft.trim()}
            >
              Send
            </Button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close support chat" : "Open support chat"}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {isOpen ? (
          <span className="text-xl leading-none">✕</span>
        ) : (
          <ChatIcon />
        )}
        {!isOpen && conversation?.hasUnread ? (
          <span
            className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-danger"
            aria-hidden="true"
          />
        ) : null}
      </button>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
