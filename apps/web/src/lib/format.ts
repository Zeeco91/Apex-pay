import type {
  QueueEntryStatus,
  ReferralBonusStatus,
  ReferredUserStatus,
  TransactionStatus,
  WithdrawalRequestStatus,
} from "@/types/api";

/** "ADMIN_HOLD" -> "Admin Hold". Used for rendering enum-shaped API values as UI labels. */
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

const REFERRED_USER_STATUS_LABELS: Record<ReferredUserStatus, string> = {
  SIGNED_UP: "Signed up — bonus triggers on their first contribution cycle",
  BONUS_HELD: "Bonus earned — on hold",
  BONUS_ELIGIBLE: "Bonus ready to withdraw",
  BONUS_WITHDRAWN: "Bonus paid",
  BONUS_FORFEITED: "Bonus forfeited",
};

export function describeReferredUserStatus(status: ReferredUserStatus): string {
  return REFERRED_USER_STATUS_LABELS[status];
}

const REFERRAL_BONUS_STATUS_LABELS: Record<ReferralBonusStatus, string> = {
  HOLD: "On hold",
  ELIGIBLE_FOR_WITHDRAWAL: "Ready to withdraw",
  WITHDRAWN: "Withdrawn",
  FORFEITED: "Forfeited",
};

export function describeReferralBonusStatus(status: ReferralBonusStatus): string {
  return REFERRAL_BONUS_STATUS_LABELS[status];
}

const WITHDRAWAL_REQUEST_STATUS_LABELS: Record<WithdrawalRequestStatus, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved — payment processing",
  REJECTED: "Rejected",
  PAID: "Paid",
};

export function describeWithdrawalRequestStatus(status: WithdrawalRequestStatus): string {
  return WITHDRAWAL_REQUEST_STATUS_LABELS[status];
}
