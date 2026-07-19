"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import {
  listConversationMessages,
  listConversations,
  markConversationRead,
  resolveConversation,
  sendConversationMessage,
} from "@/lib/api/admin/chat";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type {
  AdminSupportConversationView,
  SupportConversationStatus,
  SupportMessageView,
} from "@/types/api";

const LIST_POLL_MS = 8_000;
const MESSAGE_POLL_MS = 4_000;

export default function AdminSupportPage() {
  const { accessToken } = useAuth();

  const [conversations, setConversations] = useState<AdminSupportConversationView[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<SupportConversationStatus | "">("OPEN");
  const [search, setSearch] = useState("");
  const [listError, setListError] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageView[]>([]);
  const [threadError, setThreadError] = useState<string | null>(null);
  // Every listed conversation already has at least one message (a row only exists once its
  // first message is sent), so an empty array before the first fetch resolves is exactly
  // "still loading" — no separate boolean needed.
  const isLoadingMessages = !!selectedId && messages.length === 0 && !threadError;

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    if (!accessToken) return;
    const result = await listConversations(accessToken, {
      status: statusFilter || undefined,
      search: search || undefined,
      take: 50,
    });
    setConversations(result.conversations);
    setTotal(result.total);
  }, [accessToken, statusFilter, search]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        await refreshList();
        if (!cancelled) setListError(null);
      } catch (err) {
        if (!cancelled)
          setListError(err instanceof ApiError ? err.message : "Failed to load conversations.");
      } finally {
        if (!cancelled) setIsLoadingList(false);
      }
    })();

    const interval = setInterval(() => void refreshList(), LIST_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, refreshList]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!accessToken || !selectedId) return;
    let cancelled = false;

    async function loadThread() {
      try {
        const msgs = await listConversationMessages(accessToken!, selectedId!);
        if (!cancelled) {
          setMessages(msgs);
          setThreadError(null);
        }
        await markConversationRead(accessToken!, selectedId!);
        if (!cancelled) void refreshList();
      } catch (err) {
        if (!cancelled)
          setThreadError(err instanceof ApiError ? err.message : "Failed to load this conversation.");
      }
    }

    void loadThread();

    const interval = setInterval(() => void loadThread(), MESSAGE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // refreshList is stable per statusFilter/search change and re-running the thread poll on
    // every list refresh would be wasteful — only accessToken/selectedId should restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedId]);

  useEffect(() => {
    if (selectedId) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [selectedId, messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !accessToken || !selectedId || isSending) return;
    setIsSending(true);
    setThreadError(null);
    try {
      const result = await sendConversationMessage(accessToken, selectedId, body);
      setMessages((prev) => [...prev, result.message]);
      setDraft("");
      await refreshList();
    } catch (err) {
      setThreadError(err instanceof ApiError ? err.message : "Couldn't send your reply.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleResolve() {
    if (!accessToken || !selectedId || isResolving) return;
    setIsResolving(true);
    try {
      await resolveConversation(accessToken, selectedId);
      await refreshList();
    } catch (err) {
      setThreadError(err instanceof ApiError ? err.message : "Couldn't resolve this conversation.");
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Support</h1>
        <p className="mt-1 text-sm text-muted">
          Every member&apos;s conversation with support, most recent first — {total} total.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SupportConversationStatus | "")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
              <option value="">All</option>
            </select>
            <input
              aria-label="Search by name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted"
            />
          </div>

          {listError ? <p className="text-sm text-danger">{listError}</p> : null}

          <div className="flex flex-col gap-2 overflow-y-auto rounded-2xl border border-border bg-background p-2 lg:max-h-[36rem]">
            {isLoadingList ? (
              <p className="p-3 text-sm text-muted">Loading conversations…</p>
            ) : conversations.length === 0 ? (
              <p className="p-3 text-sm text-muted">No conversations match these filters.</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(conv.id);
                    setMessages([]);
                    setThreadError(null);
                  }}
                  aria-current={selectedId === conv.id ? "true" : undefined}
                  className={`flex flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    selectedId === conv.id ? "bg-primary text-primary-foreground" : "hover:bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{conv.userFullName}</span>
                    {conv.hasUnread ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-danger"
                        aria-label="Unread"
                        role="status"
                      />
                    ) : null}
                  </div>
                  <p
                    className={`truncate text-xs ${
                      selectedId === conv.id ? "text-primary-foreground/80" : "text-muted"
                    }`}
                  >
                    {conv.lastMessageSenderRole === "ADMIN" ? "You: " : ""}
                    {conv.lastMessagePreview}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border bg-background">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
              Select a conversation to view it.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected.userFullName}</p>
                  <p className="text-xs text-muted">{selected.userPhone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={selected.status === "OPEN" ? "info" : "success"}>
                    {selected.status === "OPEN" ? "Open" : "Resolved"}
                  </Badge>
                  {selected.status === "OPEN" ? (
                    <Button
                      variant="outline"
                      className="px-3 py-1.5 text-xs"
                      isLoading={isResolving}
                      onClick={() => void handleResolve()}
                    >
                      Mark resolved
                    </Button>
                  ) : null}
                </div>
              </div>

              <div ref={scrollRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
                {isLoadingMessages && messages.length === 0 ? (
                  <p className="text-sm text-muted">Loading messages…</p>
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.senderRole === "ADMIN"}
                      otherPartyLabel={selected.userFullName}
                    />
                  ))
                )}
              </div>

              {threadError ? <p className="px-4 text-xs text-danger">{threadError}</p> : null}

              <form
                onSubmit={(e) => void handleSend(e)}
                className="flex items-center gap-2 border-t border-border p-3"
              >
                <label htmlFor="admin-chat-reply" className="sr-only">
                  Reply
                </label>
                <input
                  id="admin-chat-reply"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type your reply…"
                  maxLength={2000}
                  className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                <Button type="submit" className="px-4 py-2 text-xs" isLoading={isSending} disabled={!draft.trim()}>
                  Send
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
