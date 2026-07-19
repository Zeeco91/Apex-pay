"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";

interface DisputeResolutionActionProps {
  onConfirm: (resolution: "CONFIRMED" | "REJECTED", notes: string) => Promise<void>;
}

export function DisputeResolutionAction({ onConfirm }: DisputeResolutionActionProps) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<"CONFIRMED" | "REJECTED">("CONFIRMED");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notesId = useId();
  const errorId = useId();

  if (!open) {
    return (
      <Button variant="outline" className="px-4 py-2 text-xs" onClick={() => setOpen(true)}>
        Resolve dispute
      </Button>
    );
  }

  async function handleConfirm() {
    if (notes.trim().length < 10) {
      setError("Please provide investigation notes of at least 10 characters.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(resolution, notes.trim());
      setOpen(false);
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-w-[280px] flex-col gap-2 rounded-xl border border-border bg-surface p-3">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium text-foreground">Resolution</legend>
        <div className="flex gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="resolution"
              checked={resolution === "CONFIRMED"}
              onChange={() => setResolution("CONFIRMED")}
            />
            Side with transaction (confirm)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="resolution"
              checked={resolution === "REJECTED"}
              onChange={() => setResolution("REJECTED")}
            />
            Side with dispute (void)
          </label>
        </div>
      </fieldset>
      <label htmlFor={notesId} className="text-xs font-medium text-foreground">
        Investigation notes
      </label>
      <textarea
        id={notesId}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        placeholder="What did you find, and why this resolution?"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1 px-3 py-1.5 text-xs"
          isLoading={isSubmitting}
          onClick={() => void handleConfirm()}
        >
          Submit resolution
        </Button>
        <Button
          variant="outline"
          className="px-3 py-1.5 text-xs"
          disabled={isSubmitting}
          onClick={() => {
            setOpen(false);
            setNotes("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
