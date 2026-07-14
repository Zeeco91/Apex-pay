"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  confirmReceipt,
  getProofUrl,
  getTransaction,
  raiseDispute,
  uploadProof,
} from "@/lib/api/transactions";
import { ApiError } from "@/lib/api/client";
import { formatNaira } from "@/lib/constants";
import { describeTransactionStatus } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import type { TransactionDetail, TransactionStatus } from "@/types/api";

const NON_DISPUTABLE_STATUSES: TransactionStatus[] = [
  "CONFIRMED",
  "DISPUTED",
  "ADMIN_RESOLVED_CONFIRMED",
  "ADMIN_RESOLVED_REJECTED",
  "CANCELLED",
];

interface TransactionPanelProps {
  transactionId: string;
  /** Called after an action that changes the parent QueueEntry's status server-side
   * (confirming receipt completes it; raising a dispute puts it on hold) — the entry list
   * this panel is rendered inside owns that state and needs to refetch it. */
  onEntryStatusChange?: () => void;
}

export function TransactionPanel({ transactionId, onEntryStatusChange }: TransactionPanelProps) {
  const { accessToken } = useAuth();
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getTransaction(accessToken, transactionId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Couldn't load transaction details.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, transactionId]);

  async function handleUploadProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !accessToken) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await uploadProof(accessToken, transactionId, file);
      setDetail(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't upload proof. Please try again.");
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleConfirm() {
    if (!accessToken) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await confirmReceipt(accessToken, transactionId);
      setDetail(updated);
      onEntryStatusChange?.();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't confirm receipt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRaiseDispute(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await raiseDispute(accessToken, transactionId, disputeReason.trim());
      setDetail(updated);
      setShowDisputeForm(false);
      onEntryStatusChange?.();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't submit the dispute. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleViewProof() {
    if (!accessToken) return;
    setActionError(null);
    try {
      const url = await getProofUrl(accessToken, transactionId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't load the proof image.");
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="mt-3 text-sm text-danger">
        {loadError}
      </p>
    );
  }

  if (!detail) {
    return <div className="mt-3 h-10 animate-pulse rounded-lg bg-surface" aria-busy="true" />;
  }

  const canDispute = !NON_DISPUTABLE_STATUSES.includes(detail.status);

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <span className="text-sm font-medium text-foreground">{describeTransactionStatus(detail.status)}</span>

      {detail.role === "PAYER" && detail.status === "AWAITING_PAYER_PROOF" && detail.potAccount && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-background p-3 text-sm text-foreground">
            <p className="font-medium">Send {formatNaira(detail.principalAmount)} to:</p>
            <p className="mt-1 text-muted">{detail.potAccount.bankName}</p>
            <p className="text-muted">
              {detail.potAccount.accountNumber} — {detail.potAccount.accountName}
            </p>
          </div>
          <div>
            <label htmlFor={`proof-${detail.id}`} className="text-sm font-medium text-foreground">
              Upload proof of payment
            </label>
            <input
              ref={fileInputRef}
              id={`proof-${detail.id}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void handleUploadProof(event)}
              disabled={isSubmitting}
              className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary-hover"
            />
          </div>
        </div>
      )}

      {detail.hasProof && (
        <button
          type="button"
          onClick={() => void handleViewProof()}
          className="self-start text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
        >
          View submitted proof
        </button>
      )}

      {detail.role === "PAYEE" && detail.status === "DISBURSED" && (
        <div className="flex flex-col gap-2">
          {detail.disbursementReference && (
            <p className="text-sm text-muted">Reference: {detail.disbursementReference}</p>
          )}
          <Button type="button" isLoading={isSubmitting} onClick={() => void handleConfirm()} className="self-start">
            {isSubmitting ? "Confirming…" : "Confirm receipt"}
          </Button>
        </div>
      )}

      {detail.status === "DISPUTED" && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          <p className="font-medium">Under review by our team</p>
          {detail.disputeReason && <p className="mt-1">{detail.disputeReason}</p>}
        </div>
      )}

      {(detail.status === "ADMIN_RESOLVED_CONFIRMED" || detail.status === "ADMIN_RESOLVED_REJECTED") &&
        detail.adminResolutionNotes && (
          <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted">
            <p className="font-medium text-foreground">Resolution notes</p>
            <p className="mt-1">{detail.adminResolutionNotes}</p>
          </div>
        )}

      {canDispute && !showDisputeForm && (
        <button
          type="button"
          onClick={() => setShowDisputeForm(true)}
          className="self-start text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground"
        >
          Something wrong? Raise a dispute
        </button>
      )}

      {showDisputeForm && (
        <form onSubmit={(event) => void handleRaiseDispute(event)} className="flex flex-col gap-2">
          <label htmlFor={`dispute-${detail.id}`} className="text-sm font-medium text-foreground">
            What went wrong?
          </label>
          <textarea
            id={`dispute-${detail.id}`}
            value={disputeReason}
            onChange={(event) => setDisputeReason(event.target.value)}
            minLength={10}
            maxLength={500}
            required
            rows={3}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <div className="flex items-center gap-4">
            <Button type="submit" variant="outline" isLoading={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit dispute"}
            </Button>
            <button
              type="button"
              onClick={() => setShowDisputeForm(false)}
              className="text-sm text-muted underline underline-offset-4 hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}
    </div>
  );
}
