export type UserRole = "USER" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "PENDING_KYC" | "ACTIVE" | "SUSPENDED" | "BANNED";
export type KycStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";

export interface PayoutBankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface PublicUser {
  id: string;
  phone: string;
  phoneVerifiedAt: string | null;
  fullName: string;
  referralCode: string;
  referredByUserId: string | null;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  payoutBankDetails: PayoutBankDetails | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface PublicLevel {
  id: string;
  name: string;
  contributionAmount: number;
  feePercent: number;
  incentiveBonusRateOfPrincipal: number;
  sortOrder: number;
}

export interface LevelQueueStats {
  levelId: string;
  levelName: string;
  contributionAmount: number;
  queueLive: true;
  waitingCount: number;
  yourEntry: { id: string; status: QueueEntryStatus; position: number | null } | null;
  message: string;
}

export type QueueEntryStatus =
  | "PENDING_JOIN_PAYMENT"
  | "WAITING_FOR_PAYOUT"
  | "MATCHED_AS_PAYEE"
  | "COMPLETED"
  | "CANCELLED"
  | "ADMIN_HOLD";

export type TransactionStatus =
  | "AWAITING_PAYER_PROOF"
  | "PROOF_SUBMITTED"
  | "PRINCIPAL_RECEIVED"
  | "PENDING_DISBURSEMENT"
  | "DISBURSED"
  | "CONFIRMED"
  | "DISPUTED"
  | "ADMIN_RESOLVED_CONFIRMED"
  | "ADMIN_RESOLVED_REJECTED"
  | "CANCELLED";

export interface QueueEntrySummary {
  id: string;
  levelId: string;
  levelName: string;
  contributionAmount: number;
  status: QueueEntryStatus;
  queueSequence: number;
  joinedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  transactionId: string | null;
  transactionStatus: TransactionStatus | null;
}

export interface JoinQueueResult {
  matched: boolean;
  entry: QueueEntrySummary;
}

export interface PotAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface TransactionDetail {
  id: string;
  levelId: string;
  status: TransactionStatus;
  role: "PAYER" | "PAYEE";
  principalAmount: number;
  platformFeeAmount: number;
  payeeDisbursedAmount: number;
  potAccount: PotAccount | null;
  hasProof: boolean;
  payerProofUploadedAt: string | null;
  principalReceivedAt: string | null;
  disbursedAt: string | null;
  disbursementReference: string | null;
  payeeConfirmedAt: string | null;
  disputeReason: string | null;
  disputeRaisedAt: string | null;
  adminResolutionNotes: string | null;
  createdAt: string;
}
