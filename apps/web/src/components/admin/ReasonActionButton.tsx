"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ReasonActionButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "outline";
  reasonRequired?: boolean;
  reasonLabel?: string;
  confirmLabel?: string;
  minLength?: number;
  placeholder?: string;
  onConfirm: (reason: string) => Promise<void>;
}

/**
 * Every discretionary admin action (suspend, ban, reject, hold, resolve-dispute, ...) requires
 * a reason server-side for the audit trail — this collapses the "click button, type reason,
 * confirm" flow into one reusable inline control instead of duplicating it on every page.
 */
export function ReasonActionButton({
  label,
  variant = "outline",
  reasonRequired = true,
  reasonLabel = "Reason",
  confirmLabel = "Confirm",
  minLength = 5,
  placeholder = "Explain why — this is recorded in the audit log",
  onConfirm,
}: ReasonActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant={variant} className="px-4 py-2 text-xs" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  async function handleConfirm() {
    if (reasonRequired && reason.trim().length < minLength) {
      setError(`Please provide at least ${minLength} characters.`);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setOpen(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-w-[240px] flex-col gap-2 rounded-xl border border-border bg-surface p-3">
      <label className="text-xs font-medium text-foreground">
        {reasonLabel}
        {reasonRequired ? "" : " (optional)"}
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        placeholder={placeholder}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          variant={variant}
          className="flex-1 px-3 py-1.5 text-xs"
          isLoading={isSubmitting}
          onClick={() => void handleConfirm()}
        >
          {confirmLabel}
        </Button>
        <Button
          variant="outline"
          className="px-3 py-1.5 text-xs"
          disabled={isSubmitting}
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
