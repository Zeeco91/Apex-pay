import { Injectable } from '@nestjs/common';
import type { AdminActionType, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type AnyClient = PrismaClient | Prisma.TransactionClient;

export interface AuditLogParams {
  adminUserId: string;
  actionType: AdminActionType;
  targetEntityType: string;
  targetEntityId: string;
  reason: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string;
}

/**
 * Records every discretionary/adverse admin action with a mandatory reason and before/after
 * state (plan §7). Pass `client` explicitly (the `tx` of an enclosing $transaction) when the
 * audited mutation must commit or roll back atomically together with the log entry — which is
 * the common case, since a state change without its audit trail defeats the point.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    params: AuditLogParams,
    client: AnyClient = this.prisma,
  ): Promise<void> {
    await client.adminAuditLog.create({
      data: {
        adminUserId: params.adminUserId,
        actionType: params.actionType,
        targetEntityType: params.targetEntityType,
        targetEntityId: params.targetEntityId,
        reason: params.reason,
        beforeState: toJsonInput(params.beforeState),
        afterState: toJsonInput(params.afterState),
        ipAddress: params.ipAddress,
      },
    });
  }

  async list(filters: {
    targetEntityType?: string;
    adminUserId?: string;
  }): Promise<
    {
      id: string;
      adminUserId: string;
      adminFullName: string;
      actionType: AdminActionType;
      targetEntityType: string;
      targetEntityId: string;
      reason: string;
      beforeState: unknown;
      afterState: unknown;
      createdAt: Date;
    }[]
  > {
    const logs = await this.prisma.adminAuditLog.findMany({
      where: {
        targetEntityType: filters.targetEntityType,
        adminUserId: filters.adminUserId,
      },
      include: { adminUser: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return logs.map((log) => ({
      id: log.id,
      adminUserId: log.adminUserId,
      adminFullName: log.adminUser.fullName,
      actionType: log.actionType,
      targetEntityType: log.targetEntityType,
      targetEntityId: log.targetEntityId,
      reason: log.reason,
      beforeState: log.beforeState,
      afterState: log.afterState,
      createdAt: log.createdAt,
    }));
  }
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
