import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type FeePool,
  type Level,
  type LevelIncentiveBonusStatus,
  type ReferralBonus,
  type ReferralBonusStatus,
  type Transaction,
  type WithdrawalRequest,
  type WithdrawalRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeLedgerEntry } from '../../common/treasury/treasury-ledger.util';
import { EXTENDED_TX_OPTIONS } from '../../common/prisma/transaction-options.util';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { addWorkingDays } from './working-day.util';

const REFERRAL_BONUS_HOLD_WORKING_DAYS = 30;
const UNIQUE_CONSTRAINT_VIOLATION_CODE = 'P2002';

type TxClient = Prisma.TransactionClient;

type ReferredUserStatus =
  | 'SIGNED_UP'
  | 'BONUS_HELD'
  | 'BONUS_ELIGIBLE'
  | 'BONUS_WITHDRAWN'
  | 'BONUS_FORFEITED';

export interface ReferredUserSummary {
  id: string;
  fullName: string;
  joinedAt: Date;
  status: ReferredUserStatus;
}

export interface ReferralBonusSummary {
  id: string;
  referredUserFullName: string;
  levelName: string;
  bonusAmount: number;
  status: ReferralBonusStatus;
  holdReleaseAt: Date;
  withdrawnAt: Date | null;
  hasWithdrawalRequest: boolean;
}

export interface WithdrawalRequestView {
  id: string;
  amount: number;
  status: WithdrawalRequestStatus;
  rejectionReason: string | null;
  paymentReference: string | null;
  paidAt: Date | null;
  createdAt: Date;
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
  holdReleaseAt: Date;
  createdAt: Date;
}

export interface AdminLevelIncentiveBonusView {
  id: string;
  payeeFullName: string;
  payeePhone: string;
  levelName: string;
  entitlementAmount: number;
  paidAmount: number;
  status: LevelIncentiveBonusStatus;
  createdAt: Date;
}

export interface AdminWithdrawalRequestView extends WithdrawalRequestView {
  userFullName: string;
  userPhone: string;
  referralBonusId: string;
}

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ---------------------------------------------------------------------------------------
  // Called by TransactionsService, inside its own DB transaction
  // ---------------------------------------------------------------------------------------

  /** Checks both parties of a just-confirmed transaction for referral bonus eligibility. */
  async tryCreateReferralBonusesForTransaction(
    tx: TxClient,
    transaction: Transaction,
  ): Promise<void> {
    await this.tryCreateReferralBonus(tx, transaction.payerUserId, transaction);
    await this.tryCreateReferralBonus(tx, transaction.payeeUserId, transaction);
  }

  private async tryCreateReferralBonus(
    tx: TxClient,
    referredUserId: string,
    transaction: Transaction,
  ): Promise<void> {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: referredUserId },
    });
    if (!user.referredByUserId) return;

    // One bonus per referred user, ever — the DB unique constraint on referredUserId is the
    // real backstop; this check just avoids a needless failed-insert attempt on the common path.
    const existing = await tx.referralBonus.findUnique({
      where: { referredUserId },
    });
    if (existing) return;

    const level = await tx.level.findUniqueOrThrow({
      where: { id: transaction.levelId },
    });
    const bonusAmount = Math.round(
      (transaction.platformFeeAmount *
        level.referralPoolAllocationPercentOfFee) /
        100,
    );
    const holdStartedAt = new Date();
    const holdReleaseAt = await addWorkingDays(
      tx,
      holdStartedAt,
      REFERRAL_BONUS_HOLD_WORKING_DAYS,
    );

    try {
      await tx.referralBonus.create({
        data: {
          referrerUserId: user.referredByUserId,
          referredUserId,
          triggerTransactionId: transaction.id,
          levelId: transaction.levelId,
          grossFeeAmount: transaction.platformFeeAmount,
          bonusAmount,
          holdStartedAt,
          holdReleaseAt,
        },
      });
    } catch (error) {
      // A referred user can be a party in more than one transaction that reaches CONFIRMED
      // around the same instant (e.g. payee in one level, payer in another, both confirmed
      // concurrently) — the `existing` check above can't see an in-flight sibling transaction,
      // so this can lose the race to the unique constraint on referredUserId. That's fine: the
      // invariant (at most one bonus per referred user) still holds, just created by the other
      // transaction instead — treat it as a benign no-op rather than failing this caller's
      // otherwise-legitimate confirmReceipt/resolveDispute action.
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION_CODE
      )) {
        throw error;
      }
    }
  }

  /**
   * Splits the fee into the three earmarked pools and, if the level offers a nonzero incentive
   * rate, pays the payee's level incentive bonus out of the now-credited incentive pool —
   * atomically, in the same DB transaction as the disbursement that funds it (plan §5a).
   */
  async allocateFeeAndPayIncentive(
    tx: TxClient,
    transaction: Transaction,
    level: Level,
  ): Promise<void> {
    const referralAlloc = Math.round(
      (transaction.platformFeeAmount *
        level.referralPoolAllocationPercentOfFee) /
        100,
    );
    const incentiveAlloc = Math.round(
      (transaction.platformFeeAmount *
        level.incentivePoolAllocationPercentOfFee) /
        100,
    );
    // Remainder rather than its own percentage calculation, so the three always sum exactly to
    // platformFeeAmount regardless of rounding on the other two.
    const platformRevenueAlloc =
      transaction.platformFeeAmount - referralAlloc - incentiveAlloc;

    await writeLedgerEntry(tx, {
      entryType: 'FEE_ALLOCATED_REFERRAL_POOL',
      amount: referralAlloc,
      relatedTransactionId: transaction.id,
      affectsBalance: false,
    });
    await tx.feePool.update({
      where: { poolType: 'REFERRAL' },
      data: {
        currentBalance: { increment: referralAlloc },
        totalAllocatedLifetime: { increment: referralAlloc },
      },
    });

    await writeLedgerEntry(tx, {
      entryType: 'FEE_ALLOCATED_INCENTIVE_POOL',
      amount: incentiveAlloc,
      relatedTransactionId: transaction.id,
      affectsBalance: false,
    });
    await tx.feePool.update({
      where: { poolType: 'LEVEL_INCENTIVE' },
      data: {
        currentBalance: { increment: incentiveAlloc },
        totalAllocatedLifetime: { increment: incentiveAlloc },
      },
    });

    await writeLedgerEntry(tx, {
      entryType: 'FEE_ALLOCATED_PLATFORM_REVENUE',
      amount: platformRevenueAlloc,
      relatedTransactionId: transaction.id,
      affectsBalance: false,
    });

    if (level.incentiveBonusRateOfPrincipal <= 0) return;
    const entitlementAmount = Math.round(
      (transaction.principalAmount * level.incentiveBonusRateOfPrincipal) / 100,
    );
    if (entitlementAmount <= 0) return;

    // Row-lock the incentive pool so two concurrent disbursements can never both read the same
    // balance and double-spend it — this check-and-deduct must happen inside one locked DB
    // transaction (plan §5a point 4).
    const [{ currentBalance: poolBalanceBefore }] = await tx.$queryRaw<
      { currentBalance: number }[]
    >(
      Prisma.sql`SELECT "currentBalance" FROM "FeePool" WHERE "poolType" = 'LEVEL_INCENTIVE' FOR UPDATE`,
    );

    const paidAmount = Math.min(entitlementAmount, poolBalanceBefore);
    const poolBalanceAfter = poolBalanceBefore - paidAmount;
    const status: LevelIncentiveBonusStatus =
      paidAmount === 0
        ? 'SKIPPED_INSUFFICIENT_POOL'
        : paidAmount < entitlementAmount
          ? 'PARTIALLY_PAID'
          : 'PAID_IN_FULL';

    if (paidAmount > 0) {
      await tx.feePool.update({
        where: { poolType: 'LEVEL_INCENTIVE' },
        data: {
          currentBalance: poolBalanceAfter,
          totalPaidLifetime: { increment: paidAmount },
        },
      });
      // Real cash leaves the pot here (on top of the DISBURSED entry), so this affects the main
      // balance — unlike the FEE_ALLOCATED_* entries above, which just re-label money already
      // sitting in the pot.
      await writeLedgerEntry(tx, {
        entryType: 'LEVEL_INCENTIVE_BONUS_PAID',
        amount: -paidAmount,
        relatedTransactionId: transaction.id,
      });
    }

    await tx.levelIncentiveBonus.create({
      data: {
        userId: transaction.payeeUserId,
        levelId: level.id,
        triggerTransactionId: transaction.id,
        entitlementAmount,
        paidAmount,
        status,
        poolBalanceBefore,
        poolBalanceAfter,
      },
    });
  }

  // ---------------------------------------------------------------------------------------
  // Member-facing
  // ---------------------------------------------------------------------------------------

  async listMyReferrals(userId: string): Promise<ReferredUserSummary[]> {
    const referred = await this.prisma.user.findMany({
      where: { referredByUserId: userId },
      include: { referralBonusReceived: true },
      orderBy: { createdAt: 'desc' },
    });
    return referred.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      joinedAt: u.createdAt,
      status: deriveReferredUserStatus(u.referralBonusReceived),
    }));
  }

  async listMyReferralBonuses(userId: string): Promise<ReferralBonusSummary[]> {
    const bonuses = await this.prisma.referralBonus.findMany({
      where: { referrerUserId: userId },
      include: { referredUser: true, level: true, withdrawalRequest: true },
      orderBy: { createdAt: 'desc' },
    });
    const promoted = await Promise.all(
      bonuses.map((b) => this.applyLazyHoldPromotion(b)),
    );
    return promoted.map((b) => ({
      id: b.id,
      referredUserFullName: b.referredUser.fullName,
      levelName: b.level.name,
      bonusAmount: b.bonusAmount,
      status: b.status,
      holdReleaseAt: b.holdReleaseAt,
      withdrawnAt: b.withdrawnAt,
      hasWithdrawalRequest: b.withdrawalRequest !== null,
    }));
  }

  async requestWithdrawal(
    userId: string,
    referralBonusId: string,
  ): Promise<WithdrawalRequestView> {
    return this.prisma.$transaction(async (tx) => {
      const bonus = await tx.referralBonus.findUnique({
        where: { id: referralBonusId },
        include: { withdrawalRequest: true },
      });
      if (!bonus || bonus.referrerUserId !== userId) {
        throw new NotFoundException('Referral bonus not found');
      }
      if (bonus.withdrawalRequest) {
        throw new ConflictException(
          'A withdrawal request already exists for this bonus.',
        );
      }

      let status = bonus.status;
      if (status === 'HOLD' && bonus.holdReleaseAt <= new Date()) {
        status = 'ELIGIBLE_FOR_WITHDRAWAL';
        await tx.referralBonus.update({
          where: { id: bonus.id },
          data: { status },
        });
      }
      if (status !== 'ELIGIBLE_FOR_WITHDRAWAL') {
        throw new ConflictException(
          status === 'HOLD'
            ? `This bonus is still on hold until ${bonus.holdReleaseAt.toISOString().slice(0, 10)}.`
            : `This bonus is ${describeStatus(status)} and can't be withdrawn.`,
        );
      }

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!user.payoutBankDetails) {
        throw new ConflictException(
          'Set up your payout bank details before requesting a withdrawal.',
        );
      }

      const request = await tx.withdrawalRequest.create({
        data: {
          userId,
          amount: bonus.bonusAmount,
          type: 'REFERRAL_BONUS',
          referralBonusId: bonus.id,
          bankDetailsSnapshot: user.payoutBankDetails,
        },
      });
      return toWithdrawalView(request);
    });
  }

  async listMyWithdrawalRequests(
    userId: string,
  ): Promise<WithdrawalRequestView[]> {
    const requests = await this.prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map(toWithdrawalView);
  }

  // ---------------------------------------------------------------------------------------
  // Admin-facing
  // ---------------------------------------------------------------------------------------

  async listFeePools(): Promise<FeePool[]> {
    return this.prisma.feePool.findMany();
  }

  async listReferralBonusesForAdmin(
    status?: ReferralBonusStatus,
  ): Promise<AdminReferralBonusView[]> {
    const bonuses = await this.prisma.referralBonus.findMany({
      where: status ? { status } : undefined,
      include: { referrerUser: true, referredUser: true, level: true },
      orderBy: { createdAt: 'desc' },
    });
    const promoted = await Promise.all(
      bonuses.map((b) => this.applyLazyHoldPromotion(b)),
    );
    return promoted.map((b) => ({
      id: b.id,
      referrerFullName: b.referrerUser.fullName,
      referrerPhone: b.referrerUser.phone,
      referredFullName: b.referredUser.fullName,
      referredPhone: b.referredUser.phone,
      levelName: b.level.name,
      bonusAmount: b.bonusAmount,
      status: b.status,
      holdReleaseAt: b.holdReleaseAt,
      createdAt: b.createdAt,
    }));
  }

  async listLevelIncentiveBonusesForAdmin(): Promise<
    AdminLevelIncentiveBonusView[]
  > {
    const bonuses = await this.prisma.levelIncentiveBonus.findMany({
      include: { user: true, level: true },
      orderBy: { createdAt: 'desc' },
    });
    return bonuses.map((b) => ({
      id: b.id,
      payeeFullName: b.user.fullName,
      payeePhone: b.user.phone,
      levelName: b.level.name,
      entitlementAmount: b.entitlementAmount,
      paidAmount: b.paidAmount,
      status: b.status,
      createdAt: b.createdAt,
    }));
  }

  async listWithdrawalRequestsForAdmin(
    status?: WithdrawalRequestStatus,
  ): Promise<AdminWithdrawalRequestView[]> {
    const requests = await this.prisma.withdrawalRequest.findMany({
      where: status ? { status } : undefined,
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return requests.map((r) => ({
      ...toWithdrawalView(r),
      userFullName: r.user.fullName,
      userPhone: r.user.phone,
      referralBonusId: r.referralBonusId,
    }));
  }

  async approveWithdrawal(
    adminId: string,
    id: string,
  ): Promise<WithdrawalRequestView> {
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Withdrawal request not found');
    if (request.status !== 'PENDING') {
      throw new ConflictException(
        `Can't approve — this request is ${describeStatus(request.status)}.`,
      );
    }
    const updated = await this.prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
      },
    });
    await this.auditLog.record({
      adminUserId: adminId,
      actionType: 'WITHDRAWAL_APPROVED',
      targetEntityType: 'WithdrawalRequest',
      targetEntityId: id,
      reason: `Withdrawal of ₦${request.amount} approved`,
      beforeState: { status: request.status },
      afterState: { status: updated.status },
    });
    return toWithdrawalView(updated);
  }

  async rejectWithdrawal(
    adminId: string,
    id: string,
    reason: string,
  ): Promise<WithdrawalRequestView> {
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Withdrawal request not found');
    if (request.status !== 'PENDING') {
      throw new ConflictException(
        `Can't reject — this request is ${describeStatus(request.status)}.`,
      );
    }
    const updated = await this.prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
      },
    });
    await this.auditLog.record({
      adminUserId: adminId,
      actionType: 'WITHDRAWAL_REJECTED',
      targetEntityType: 'WithdrawalRequest',
      targetEntityId: id,
      reason,
      beforeState: { status: request.status },
      afterState: { status: updated.status },
    });
    return toWithdrawalView(updated);
  }

  async markWithdrawalPaid(
    adminId: string,
    id: string,
    reference: string,
  ): Promise<WithdrawalRequestView> {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundException('Withdrawal request not found');
      if (request.status !== 'APPROVED') {
        throw new ConflictException(
          `Can't mark paid — this request is ${describeStatus(request.status)}.`,
        );
      }

      // Row-lock the referral pool so this can't pay out more than is actually earmarked —
      // same reasoning as the incentive pool lock in allocateFeeAndPayIncentive.
      const [{ currentBalance }] = await tx.$queryRaw<
        { currentBalance: number }[]
      >(
        Prisma.sql`SELECT "currentBalance" FROM "FeePool" WHERE "poolType" = 'REFERRAL' FOR UPDATE`,
      );
      if (currentBalance < request.amount) {
        throw new ConflictException(
          `Referral pool balance (₦${currentBalance}) can't cover this ₦${request.amount} bonus yet — check back once more fee revenue has accumulated.`,
        );
      }

      const updated = await tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: 'PAID',
          paymentReference: reference,
          paidAt: new Date(),
        },
      });

      const bonus = await tx.referralBonus.update({
        where: { id: request.referralBonusId },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
      });

      await tx.feePool.update({
        where: { poolType: 'REFERRAL' },
        data: {
          currentBalance: { decrement: request.amount },
          totalPaidLifetime: { increment: request.amount },
        },
      });
      await writeLedgerEntry(tx, {
        entryType: 'REFERRAL_BONUS_PAID',
        amount: -request.amount,
        relatedTransactionId: bonus.triggerTransactionId,
      });

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'WITHDRAWAL_PAID',
          targetEntityType: 'WithdrawalRequest',
          targetEntityId: id,
          reason: `Paid ₦${request.amount}, reference ${reference}`,
          beforeState: { status: request.status },
          afterState: { status: updated.status, reference },
        },
        tx,
      );

      return toWithdrawalView(updated);
    }, EXTENDED_TX_OPTIONS);
  }

  private async applyLazyHoldPromotion<T extends ReferralBonus>(
    bonus: T,
  ): Promise<T> {
    if (bonus.status === 'HOLD' && bonus.holdReleaseAt <= new Date()) {
      const updated = await this.prisma.referralBonus.update({
        where: { id: bonus.id },
        data: { status: 'ELIGIBLE_FOR_WITHDRAWAL' },
      });
      return { ...bonus, status: updated.status };
    }
    return bonus;
  }
}

function deriveReferredUserStatus(
  bonus: ReferralBonus | null,
): ReferredUserStatus {
  if (!bonus) return 'SIGNED_UP';
  if (bonus.status === 'WITHDRAWN') return 'BONUS_WITHDRAWN';
  if (bonus.status === 'ELIGIBLE_FOR_WITHDRAWAL') return 'BONUS_ELIGIBLE';
  if (bonus.status === 'FORFEITED') return 'BONUS_FORFEITED';
  return 'BONUS_HELD';
}

function toWithdrawalView(request: WithdrawalRequest): WithdrawalRequestView {
  return {
    id: request.id,
    amount: request.amount,
    status: request.status,
    rejectionReason: request.rejectionReason,
    paymentReference: request.paymentReference,
    paidAt: request.paidAt,
    createdAt: request.createdAt,
  };
}

function describeStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}
