import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  Level,
  Prisma,
  Transaction,
  TransactionStatus,
  TreasuryEntryType,
  User,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FILE_STORAGE_PROVIDER,
  type FileStorageProvider,
} from '../../common/file-storage/file-storage-provider.interface';
import { validateProofImage } from '../../common/file-storage/image-validation.util';
import { writeLedgerEntry } from '../../common/treasury/treasury-ledger.util';
import { EXTENDED_TX_OPTIONS } from '../../common/prisma/transaction-options.util';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { ReferralsService } from '../referrals/referrals.service';
import type { Env } from '../../config/env.validation';

const TERMINAL_TRANSACTION_STATUSES: TransactionStatus[] = [
  'CONFIRMED',
  'DISPUTED',
  'ADMIN_RESOLVED_CONFIRMED',
  'ADMIN_RESOLVED_REJECTED',
  'CANCELLED',
];

export interface PotAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface TransactionDetail {
  id: string;
  levelId: string;
  status: TransactionStatus;
  role: 'PAYER' | 'PAYEE';
  principalAmount: number;
  platformFeeAmount: number;
  payeeDisbursedAmount: number;
  potAccount: PotAccount | null;
  hasProof: boolean;
  payerProofUploadedAt: Date | null;
  principalReceivedAt: Date | null;
  disbursedAt: Date | null;
  disbursementReference: string | null;
  payeeConfirmedAt: Date | null;
  disputeReason: string | null;
  disputeRaisedAt: Date | null;
  adminResolutionNotes: string | null;
  createdAt: Date;
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
  payer: { id: string; fullName: string; phone: string };
  payee: { id: string; fullName: string; phone: string };
  payerProofUploadedAt: Date | null;
  principalReceivedAt: Date | null;
  disbursedAt: Date | null;
  disbursementReference: string | null;
  payeeConfirmedAt: Date | null;
  disputeReason: string | null;
  disputeRaisedAt: Date | null;
  createdAt: Date;
}

export interface TreasuryLedgerEntryView {
  id: string;
  entryType: TreasuryEntryType;
  amount: number;
  balanceAfter: number;
  relatedTransactionId: string | null;
  createdAt: Date;
}

type TxClient = Prisma.TransactionClient;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE_PROVIDER)
    private readonly fileStorage: FileStorageProvider,
    private readonly config: ConfigService<Env, true>,
    private readonly referralsService: ReferralsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getForUser(
    userId: string,
    transactionId: string,
  ): Promise<TransactionDetail> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    assertIsParty(transaction, userId);
    return this.toDetail(transaction, userId);
  }

  async uploadProof(
    userId: string,
    transactionId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<TransactionDetail> {
    const { extension } = validateProofImage(file);

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });
      if (!transaction || transaction.payerUserId !== userId) {
        throw new NotFoundException('Transaction not found');
      }
      if (transaction.status !== 'AWAITING_PAYER_PROOF') {
        throw new ConflictException(
          `Can't upload proof — this transaction is ${describeStatus(transaction.status)}.`,
        );
      }

      const saved = await this.fileStorage.save({
        buffer: file.buffer,
        extension,
        folder: 'proofs',
      });

      const updated = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PROOF_SUBMITTED',
          payerProofImageKey: saved.key,
          payerProofUploadedAt: new Date(),
        },
      });

      return this.toDetail(updated, userId);
    });
  }

  async getProofUrl(userId: string, transactionId: string): Promise<string> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    assertIsParty(transaction, userId);
    if (!transaction.payerProofImageKey) {
      throw new NotFoundException('No proof has been uploaded yet');
    }
    return this.fileStorage.getSignedUrl(transaction.payerProofImageKey);
  }

  async confirmReceipt(
    userId: string,
    transactionId: string,
  ): Promise<TransactionDetail> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });
      if (!transaction || transaction.payeeUserId !== userId) {
        throw new NotFoundException('Transaction not found');
      }
      if (transaction.status !== 'DISBURSED') {
        throw new ConflictException(
          `Can't confirm receipt — this transaction is ${describeStatus(transaction.status)}.`,
        );
      }

      const updated = await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: 'CONFIRMED', payeeConfirmedAt: new Date() },
      });

      await tx.queueEntry.update({
        where: { id: transaction.payeeQueueEntryId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      // Their original queueSequence is untouched — they now wait for their own payout in the
      // same relative position they'd have if they'd joined fresh at that moment.
      await tx.queueEntry.update({
        where: { id: transaction.payerQueueEntryId },
        data: { status: 'WAITING_FOR_PAYOUT' },
      });

      // Either party (or both) may be a referred user completing their first-ever transaction —
      // this is the "not just at sign-up" trigger point for the referral bonus (plan §5).
      await this.referralsService.tryCreateReferralBonusesForTransaction(
        tx,
        transaction,
      );

      return this.toDetail(updated, userId);
    }, EXTENDED_TX_OPTIONS);
  }

  async raiseDispute(
    userId: string,
    transactionId: string,
    reason: string,
  ): Promise<TransactionDetail> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });
      if (
        !transaction ||
        (transaction.payerUserId !== userId &&
          transaction.payeeUserId !== userId)
      ) {
        throw new NotFoundException('Transaction not found');
      }
      if (TERMINAL_TRANSACTION_STATUSES.includes(transaction.status)) {
        throw new ConflictException(
          `Can't raise a dispute — this transaction is already ${describeStatus(transaction.status)}.`,
        );
      }

      const updated = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'DISPUTED',
          disputeReason: reason,
          disputeRaisedByUserId: userId,
          disputeRaisedAt: new Date(),
        },
      });

      await tx.queueEntry.updateMany({
        where: {
          id: {
            in: [transaction.payerQueueEntryId, transaction.payeeQueueEntryId],
          },
        },
        data: { status: 'ADMIN_HOLD' },
      });

      return this.toDetail(updated, userId);
    });
  }

  // ---------------------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------------------

  async listForAdmin(
    status?: TransactionStatus,
  ): Promise<AdminTransactionSummary[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: status ? { status } : undefined,
      include: { level: true, payerUser: true, payeeUser: true },
      orderBy: { createdAt: 'asc' },
    });
    return transactions.map(toAdminSummary);
  }

  async confirmPrincipal(
    adminId: string,
    transactionId: string,
  ): Promise<AdminTransactionSummary> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });
      if (!transaction) throw new NotFoundException('Transaction not found');
      if (transaction.status !== 'PROOF_SUBMITTED') {
        throw new ConflictException(
          `Can't confirm principal — this transaction is ${describeStatus(transaction.status)}.`,
        );
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PENDING_DISBURSEMENT',
          principalReceivedAt: new Date(),
          principalConfirmedByAdminId: adminId,
        },
      });

      await writeLedgerEntry(tx, {
        entryType: 'PRINCIPAL_COLLECTED',
        amount: transaction.principalAmount,
        relatedTransactionId: transaction.id,
      });

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'TRANSACTION_PRINCIPAL_CONFIRMED',
          targetEntityType: 'Transaction',
          targetEntityId: transaction.id,
          reason: `Principal of ₦${transaction.principalAmount} confirmed received into the pot`,
          beforeState: { status: transaction.status },
          afterState: { status: 'PENDING_DISBURSEMENT' },
        },
        tx,
      );

      return this.loadAdminSummary(tx, transaction.id);
    });
  }

  async disburse(
    adminId: string,
    transactionId: string,
    params: { reference: string },
  ): Promise<AdminTransactionSummary> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });
      if (!transaction) throw new NotFoundException('Transaction not found');
      if (transaction.status !== 'PENDING_DISBURSEMENT') {
        throw new ConflictException(
          `Can't disburse — this transaction is ${describeStatus(transaction.status)}.`,
        );
      }

      const [payee, level] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { id: transaction.payeeUserId } }),
        tx.level.findUniqueOrThrow({ where: { id: transaction.levelId } }),
      ]);
      if (!payee.payoutBankDetails) {
        throw new ConflictException(
          'Payee has not set up payout bank details yet.',
        );
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'DISBURSED',
          disbursedAt: new Date(),
          disbursedByAdminId: adminId,
          disbursementReference: params.reference,
          payeeBankDetailsSnapshot: payee.payoutBankDetails,
        },
      });

      // Principal (full amount) was already counted as collected when the admin confirmed
      // receipt — only the payee's share actually leaves the pot here.
      await writeLedgerEntry(tx, {
        entryType: 'DISBURSED',
        amount: -transaction.payeeDisbursedAmount,
        relatedTransactionId: transaction.id,
      });
      // Splits the fee into referral/incentive/platform-revenue pools (informational for the
      // main pot balance — see writeLedgerEntry's affectsBalance doc) and, if this level offers
      // one, pays the payee's level incentive bonus out of the now-updated incentive pool.
      await this.referralsService.allocateFeeAndPayIncentive(
        tx,
        transaction,
        level,
      );

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'TRANSACTION_DISBURSED',
          targetEntityType: 'Transaction',
          targetEntityId: transaction.id,
          reason: `Disbursed ₦${transaction.payeeDisbursedAmount} to payee, reference ${params.reference}`,
          beforeState: { status: transaction.status },
          afterState: { status: 'DISBURSED', reference: params.reference },
        },
        tx,
      );

      return this.loadAdminSummary(tx, transaction.id);
    }, EXTENDED_TX_OPTIONS);
  }

  async resolveDispute(
    adminId: string,
    transactionId: string,
    params: { resolution: 'CONFIRMED' | 'REJECTED'; notes: string },
  ): Promise<AdminTransactionSummary> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });
      if (!transaction) throw new NotFoundException('Transaction not found');
      if (transaction.status !== 'DISPUTED') {
        throw new ConflictException(
          `Can't resolve — this transaction is ${describeStatus(transaction.status)}, not disputed.`,
        );
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status:
            params.resolution === 'CONFIRMED'
              ? 'ADMIN_RESOLVED_CONFIRMED'
              : 'ADMIN_RESOLVED_REJECTED',
          adminResolutionNotes: params.notes,
          adminResolvedByAdminId: adminId,
          adminResolvedAt: new Date(),
        },
      });

      if (params.resolution === 'CONFIRMED') {
        // Admin investigated and confirms the transaction proceeded legitimately — restore
        // queue entries to what a normal CONFIRMED completion would have produced.
        await tx.queueEntry.update({
          where: { id: transaction.payeeQueueEntryId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        await tx.queueEntry.update({
          where: { id: transaction.payerQueueEntryId },
          data: { status: 'WAITING_FOR_PAYOUT' },
        });
        // Admin-resolved-confirmed is a legitimate completion in every respect — treat it the
        // same as a normal confirmReceipt for referral bonus triggering.
        await this.referralsService.tryCreateReferralBonusesForTransaction(
          tx,
          transaction,
        );
      } else {
        // Admin sides with the dispute — void the match, both parties return to the pool
        // unmatched. This does not reverse any treasury ledger entries already recorded for
        // this transaction; clawing back money already moved is a manual finance action
        // outside what this endpoint can do on its own.
        await tx.queueEntry.update({
          where: { id: transaction.payeeQueueEntryId },
          data: { status: 'WAITING_FOR_PAYOUT' },
        });
        await tx.queueEntry.update({
          where: { id: transaction.payerQueueEntryId },
          data: { status: 'WAITING_FOR_PAYOUT' },
        });
      }

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'TRANSACTION_DISPUTE_RESOLVED',
          targetEntityType: 'Transaction',
          targetEntityId: transaction.id,
          reason: params.notes,
          beforeState: { status: transaction.status },
          afterState: {
            status:
              params.resolution === 'CONFIRMED'
                ? 'ADMIN_RESOLVED_CONFIRMED'
                : 'ADMIN_RESOLVED_REJECTED',
          },
        },
        tx,
      );

      return this.loadAdminSummary(tx, transaction.id);
    }, EXTENDED_TX_OPTIONS);
  }

  async getTreasuryLedger(): Promise<TreasuryLedgerEntryView[]> {
    const entries = await this.prisma.treasuryLedgerEntry.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return entries;
  }

  // ---------------------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------------------

  private async loadAdminSummary(
    tx: TxClient,
    transactionId: string,
  ): Promise<AdminTransactionSummary> {
    const transaction = await tx.transaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: { level: true, payerUser: true, payeeUser: true },
    });
    return toAdminSummary(transaction);
  }

  private toDetail(
    transaction: Transaction,
    requestingUserId: string,
  ): TransactionDetail {
    const role: 'PAYER' | 'PAYEE' =
      transaction.payerUserId === requestingUserId ? 'PAYER' : 'PAYEE';
    return {
      id: transaction.id,
      levelId: transaction.levelId,
      status: transaction.status,
      role,
      principalAmount: transaction.principalAmount,
      platformFeeAmount: transaction.platformFeeAmount,
      payeeDisbursedAmount: transaction.payeeDisbursedAmount,
      potAccount: role === 'PAYER' ? this.potAccount() : null,
      hasProof: transaction.payerProofImageKey !== null,
      payerProofUploadedAt: transaction.payerProofUploadedAt,
      principalReceivedAt: transaction.principalReceivedAt,
      disbursedAt: transaction.disbursedAt,
      disbursementReference: transaction.disbursementReference,
      payeeConfirmedAt: transaction.payeeConfirmedAt,
      disputeReason: transaction.disputeReason,
      disputeRaisedAt: transaction.disputeRaisedAt,
      adminResolutionNotes: transaction.adminResolutionNotes,
      createdAt: transaction.createdAt,
    };
  }

  private potAccount(): PotAccount {
    return {
      bankName: this.config.get('POT_ACCOUNT_BANK_NAME', { infer: true }),
      accountNumber: this.config.get('POT_ACCOUNT_NUMBER', { infer: true }),
      accountName: this.config.get('POT_ACCOUNT_NAME', { infer: true }),
    };
  }
}

function assertIsParty(
  transaction: Transaction | null,
  userId: string,
): asserts transaction is Transaction {
  // Same 404 whether the transaction doesn't exist or the caller isn't a party to it — don't
  // let this endpoint become an oracle for "does transaction X exist".
  if (
    !transaction ||
    (transaction.payerUserId !== userId && transaction.payeeUserId !== userId)
  ) {
    throw new NotFoundException('Transaction not found');
  }
}

function describeStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}

function toAdminSummary(
  transaction: Transaction & { level: Level; payerUser: User; payeeUser: User },
): AdminTransactionSummary {
  return {
    id: transaction.id,
    levelId: transaction.levelId,
    levelName: transaction.level.name,
    status: transaction.status,
    matchType: transaction.matchType,
    principalAmount: transaction.principalAmount,
    platformFeeAmount: transaction.platformFeeAmount,
    payeeDisbursedAmount: transaction.payeeDisbursedAmount,
    payer: {
      id: transaction.payerUser.id,
      fullName: transaction.payerUser.fullName,
      phone: transaction.payerUser.phone,
    },
    payee: {
      id: transaction.payeeUser.id,
      fullName: transaction.payeeUser.fullName,
      phone: transaction.payeeUser.phone,
    },
    payerProofUploadedAt: transaction.payerProofUploadedAt,
    principalReceivedAt: transaction.principalReceivedAt,
    disbursedAt: transaction.disbursedAt,
    disbursementReference: transaction.disbursementReference,
    payeeConfirmedAt: transaction.payeeConfirmedAt,
    disputeReason: transaction.disputeReason,
    disputeRaisedAt: transaction.disputeRaisedAt,
    createdAt: transaction.createdAt,
  };
}
