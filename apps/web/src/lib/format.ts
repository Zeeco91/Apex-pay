import type { QueueEntryStatus, TransactionStatus } from "@/types/api";

/** "PENDING_KYC" -> "Pending Kyc". Used for rendering enum-shaped API values as UI labels. */
export function formatEnumLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const QUEUE_ENTRY_STATUS_LABELS: Record<QueueEntryStatus, string> = {
  PENDING_JOIN_PAYMENT: "Matched — awaiting your contribution",
  WAITING_FOR_PAYOUT: "Waiting for a payout",
  MATCHED_AS_PAYEE: "Matched — you'll receive a payout soon",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  ADMIN_HOLD: "On hold — contact support",
};

export function describeQueueEntryStatus(status: QueueEntryStatus): string {
  return QUEUE_ENTRY_STATUS_LABELS[status];
}

const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  AWAITING_PAYER_PROOF: "Awaiting your proof of payment",
  PROOF_SUBMITTED: "Proof submitted — awaiting confirmation",
  PRINCIPAL_RECEIVED: "Contribution received — payout processing",
  PENDING_DISBURSEMENT: "Payout processing",
  DISBURSED: "Payout sent — awaiting your confirmation",
  CONFIRMED: "Confirmed",
  DISPUTED: "Under review",
  ADMIN_RESOLVED_CONFIRMED: "Resolved — confirmed",
  ADMIN_RESOLVED_REJECTED: "Resolved — voided",
  CANCELLED: "Cancelled",
};

export function describeTransactionStatus(status: TransactionStatus): string {
  return TRANSACTION_STATUS_LABELS[status];
}
