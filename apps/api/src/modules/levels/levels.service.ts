import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Level } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';

export interface PublicLevel {
  id: string;
  name: string;
  contributionAmount: number;
  feePercent: number;
  incentiveBonusRateOfPrincipal: number;
  sortOrder: number;
}

const PERCENT_SUM_TOLERANCE = 0.01;

@Injectable()
export class LevelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAllActive(): Promise<PublicLevel[]> {
    const levels = await this.prisma.level.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return levels.map(toPublicLevel);
  }

  // ---------------------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------------------

  async listForAdmin(): Promise<Level[]> {
    return this.prisma.level.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async updateForAdmin(
    adminId: string,
    id: string,
    changes: Partial<
      Pick<
        Level,
        | 'name'
        | 'contributionAmount'
        | 'feePercent'
        | 'referralPoolAllocationPercentOfFee'
        | 'incentivePoolAllocationPercentOfFee'
        | 'platformRevenuePercentOfFee'
        | 'incentiveBonusRateOfPrincipal'
        | 'stalledThresholdDays'
        | 'isActive'
      >
    >,
  ): Promise<Level> {
    const existing = await this.prisma.level.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Level not found');

    // UpdateLevelDto's declared class fields exist as own properties set to `undefined` on
    // every instance, even when the client never sent them — spreading the raw DTO would
    // clobber `existing`'s real values with `undefined` below. Strip those out first so only
    // fields the admin actually provided are treated as changes.
    const definedChanges = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as typeof changes;

    const merged = { ...existing, ...definedChanges };
    const percentSum =
      merged.referralPoolAllocationPercentOfFee +
      merged.incentivePoolAllocationPercentOfFee +
      merged.platformRevenuePercentOfFee;
    if (Math.abs(percentSum - 100) > PERCENT_SUM_TOLERANCE) {
      throw new ConflictException(
        `The referral, incentive, and platform-revenue allocation percentages must sum to 100 — they currently sum to ${percentSum}.`,
      );
    }

    const updated = await this.prisma.level.update({
      where: { id },
      data: definedChanges,
    });

    // Snapshot only the changed fields (not the full row — createdAt/updatedAt aren't
    // meaningful audit info, and Date instances aren't valid Prisma Json input as-is).
    const changedKeys = Object.keys(
      definedChanges,
    ) as (keyof typeof definedChanges)[];
    const beforeState = Object.fromEntries(
      changedKeys.map((key) => [key, existing[key]]),
    );
    const afterState = Object.fromEntries(
      changedKeys.map((key) => [key, updated[key]]),
    );

    await this.auditLog.record({
      adminUserId: adminId,
      actionType: 'LEVEL_UPDATED',
      targetEntityType: 'Level',
      targetEntityId: id,
      reason: `Level config updated: ${changedKeys.join(', ')}`,
      beforeState,
      afterState,
    });

    return updated;
  }
}

function toPublicLevel(level: Level): PublicLevel {
  return {
    id: level.id,
    name: level.name,
    contributionAmount: level.contributionAmount,
    feePercent: level.feePercent,
    incentiveBonusRateOfPrincipal: level.incentiveBonusRateOfPrincipal,
    sortOrder: level.sortOrder,
  };
}
