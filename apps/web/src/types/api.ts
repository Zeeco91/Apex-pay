export type UserRole = "USER" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "PENDING_KYC" | "ACTIVE" | "SUSPENDED" | "BANNED";

export interface PayoutBankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface PublicUser {
  id: string;
  phone: string;
  phoneVerifiedAt: string | null;
  email: string | null;
  fullName: string;
  referralCode: string;
  referredByUserId: string | null;
  role: UserRole;
  status: UserStatus;
  payoutBankDetails: PayoutBankDetails | null;
  mfaEnabled: boolean;
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

export interface TransactionCounterpart {
  fullName: string;
  phone: string;
}

export interface TransactionDetail {
  id: string;
  levelId: string;
  status: TransactionStatus;
  role: "PAYER" | "PAYEE";
  principalAmount: number;
  // Who you're matched with — visible to both parties.
  counterpart: TransactionCounterpart;
  // Only populated for the payer — the payee's bank details, to pay them directly.
  payeeBankDetails: PayoutBankDetails | null;
  hasProof: boolean;
  payerProofUploadedAt: string | null;
  payeeConfirmedAt: string | null;
  disputeReason: string | null;
  disputeRaisedAt: string | null;
  adminResolutionNotes: string | null;
  createdAt: string;
}

export type ReferredUserStatus =
  | "SIGNED_UP"
  | "BONUS_HELD"
  | "BONUS_ELIGIBLE"
  | "BONUS_WITHDRAWN"
  | "BONUS_FORFEITED";

export interface ReferredUserSummary {
  id: string;
  fullName: string;
  joinedAt: string;
  status: ReferredUserStatus;
}

export type ReferralBonusStatus = "HOLD" | "ELIGIBLE_FOR_WITHDRAWAL" | "WITHDRAWN" | "FORFEITED";

export interface ReferralBonusSummary {
  id: string;
  referredUserFullName: string;
  levelName: string;
  bonusAmount: number;
  status: ReferralBonusStatus;
  holdReleaseAt: string;
  withdrawnAt: string | null;
  hasWithdrawalRequest: boolean;
}

export type WithdrawalRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export interface WithdrawalRequestView {
  id: string;
  amount: number;
  status: WithdrawalRequestStatus;
  rejectionReason: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------

export interface AdminUserSummary {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  referralCode: string;
  referredByUserId: string | null;
  payoutBankDetails: PayoutBankDetails | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminQueueEntryView {
  id: string;
  userId: string;
  userFullName: string;
  userPhone: string;
  status: QueueEntryStatus;
  queueSequence: number;
  joinedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  transactionId: string | null;
  transactionStatus: TransactionStatus | null;
}

export interface AdminAggregateParty {
  id: string;
  fullName: string;
  phone: string;
}

export interface AdminTransactionSummary {
  id: string;
  levelId: string;
  levelName: string;
  status: TransactionStatus;
  matchType: string;
  principalAmount: number;
  platformFeeAmount: number;
  payeeDisbursedAmount: number;
  payer: AdminAggregateParty;
  payee: AdminAggregateParty;
  payerProofUploadedAt: string | null;
  principalReceivedAt: string | null;
  disbursedAt: string | null;
  disbursementReference: string | null;
  payeeConfirmedAt: string | null;
  disputeReason: string | null;
  disputeRaisedAt: string | null;
  createdAt: string;
}

export type TreasuryEntryType =
  | "PRINCIPAL_COLLECTED"
  | "DISBURSED"
  | "FEE_COLLECTED"
  | "FEE_ALLOCATED_REFERRAL_POOL"
  | "FEE_ALLOCATED_INCENTIVE_POOL"
  | "FEE_ALLOCATED_PLATFORM_REVENUE"
  | "REFERRAL_BONUS_PAID"
  | "LEVEL_INCENTIVE_BONUS_PAID"
  | "PLATFORM_REVENUE_WITHDRAWN";

export interface TreasuryLedgerEntryView {
  id: string;
  entryType: TreasuryEntryType;
  amount: number;
  balanceAfter: number;
  relatedTransactionId: string | null;
  createdAt: string;
}

export interface AdminWithdrawalRequestView extends WithdrawalRequestView {
  userFullName: string;
  userPhone: string;
  referralBonusId: string;
}

export interface AdminReferralBonusView {
  id: string;
  referrerFullName: string;
  referrerPhone: string;
  referredFullName: string;
  referredPhone: string;
  levelName: string;
  bonusAmount: number;
  status: ReferralBonusStatus;
  holdReleaseAt: string;
  createdAt: string;
}

export type LevelIncentiveBonusStatus =
  | "PAID_IN_FULL"
  | "PARTIALLY_PAID"
  | "SKIPPED_INSUFFICIENT_POOL";

export interface AdminLevelIncentiveBonusView {
  id: string;
  payeeFullName: string;
  payeePhone: string;
  levelName: string;
  entitlementAmount: number;
  paidAmount: number;
  status: LevelIncentiveBonusStatus;
  createdAt: string;
}

export type FeePoolType = "REFERRAL" | "LEVEL_INCENTIVE";

export interface FeePoolView {
  id: string;
  poolType: FeePoolType;
  currentBalance: number;
  totalAllocatedLifetime: number;
  totalPaidLifetime: number;
  updatedAt: string;
}

export interface AdminLevel {
  id: string;
  name: string;
  contributionAmount: number;
  feePercent: number;
  referralPoolAllocationPercentOfFee: number;
  incentivePoolAllocationPercentOfFee: number;
  platformRevenuePercentOfFee: number;
  incentiveBonusRateOfPrincipal: number;
  stalledThresholdDays: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicHolidayView {
  id: string;
  date: string;
  name: string;
}

export type AdminActionType =
  | "USER_SUSPENDED"
  | "USER_BANNED"
  | "USER_REINSTATED"
  | "QUEUE_ENTRY_HELD"
  | "QUEUE_ENTRY_RELEASED"
  | "QUEUE_MANUAL_MATCH"
  | "LEVEL_UPDATED"
  | "TRANSACTION_PRINCIPAL_CONFIRMED"
  | "TRANSACTION_DISBURSED"
  | "TRANSACTION_DISPUTE_RESOLVED"
  | "WITHDRAWAL_APPROVED"
  | "WITHDRAWAL_REJECTED"
  | "WITHDRAWAL_PAID"
  | "PUBLIC_HOLIDAY_ADDED"
  | "PUBLIC_HOLIDAY_REMOVED";

export interface AdminAuditLogEntry {
  id: string;
  adminUserId: string;
  adminFullName: string;
  actionType: AdminActionType;
  targetEntityType: string;
  targetEntityId: string;
  reason: string;
  beforeState: unknown;
  afterState: unknown;
  createdAt: string;
}

export interface AuditLogPage {
  entries: AdminAuditLogEntry[];
  total: number;
}

// ---------------------------------------------------------------------------------------
// Admin Reporting & Treasury Reconciliation (Phase 9)
// ---------------------------------------------------------------------------------------

export type ReconciliationTrigger = "SCHEDULED" | "MANUAL";

export interface ReconciliationRunView {
  id: string;
  runAt: string;
  treasuryBalanceExpected: number;
  treasuryBalanceActual: number;
  treasuryDrift: number;
  referralPoolExpected: number;
  referralPoolActual: number;
  referralPoolDrift: number;
  incentivePoolExpected: number;
  incentivePoolActual: number;
  incentivePoolDrift: number;
  hasDiscrepancy: boolean;
  triggeredBy: ReconciliationTrigger;
}

export interface LevelQueueHealth {
  levelId: string;
  levelName: string;
  isActive: boolean;
  waitingCount: number;
  oldestWaitingAgeDays: number | null;
  stalledCount: number;
  stalledThresholdDays: number;
  completedCount: number;
  avgCompletionDays: number | null;
}

export interface FlaggedUser {
  id: string;
  fullName: string;
  phone: string;
}

export interface SharedBankDetailsFlag {
  accountNumber: string;
  bankName: string;
  users: FlaggedUser[];
}

export interface ReferralBurstFlag {
  referrer: FlaggedUser;
  windowStart: string;
  referredCount: number;
  referredUsers: FlaggedUser[];
}

export interface FraudFlagsSummary {
  sharedBankDetails: SharedBankDetailsFlag[];
  referralBursts: ReferralBurstFlag[];
}

// ---------------------------------------------------------------------------------------
// Support Chat (personal chatroom with admin)
// ---------------------------------------------------------------------------------------

export type SupportConversationStatus = "OPEN" | "RESOLVED";
export type SupportMessageSenderRole = "USER" | "ADMIN";

export interface SupportMessageView {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: SupportMessageSenderRole;
  body: string;
  createdAt: string;
}

export interface SupportConversationView {
  id: string;
  status: SupportConversationStatus;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageSenderRole: SupportMessageSenderRole;
  hasUnread: boolean;
}

export interface AdminSupportConversationView extends SupportConversationView {
  userId: string;
  userFullName: string;
  userPhone: string;
  resolvedAt: string | null;
}

export interface AdminSupportConversationPage {
  conversations: AdminSupportConversationView[];
  total: number;
}
