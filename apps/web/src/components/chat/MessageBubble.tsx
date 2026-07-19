import type { SupportMessageView } from "@/types/api";

interface MessageBubbleProps {
  message: SupportMessageView;
  isOwn: boolean;
  /** Label for messages from the other party — "Support" in the member widget, the
   * member's name in the admin inbox. */
  otherPartyLabel: string;
}

/** `isOwn` is from the current viewer's perspective — a user's own USER messages, or an
 * admin's own ADMIN messages — not a fixed sender role, since the same message renders on
 * both the member widget and the admin inbox. */
export function MessageBubble({ message, isOwn, otherPartyLabel }: MessageBubbleProps) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-surface text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={`mt-1 text-[11px] ${isOwn ? "text-primary-foreground/70" : "text-muted"}`}>
          {isOwn ? "You" : otherPartyLabel} · {time}
        </p>
      </div>
    </div>
  );
}
