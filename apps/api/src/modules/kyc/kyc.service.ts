import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { KycRecord, KycStatus, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';

export interface AdminKycRecordView {
  id: string;
  userId: string;
  userFullName: string;
  userPhone: string;
  idType: string;
  idNumber: string;
  status: KycStatus;
  rejectionReason: string | null;
  createdAt: Date;
}

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly auditLog: AuditLogService,
  ) {}

  async submit(
    userId: string,
    params: { idType: string; idNumber: string },
  ): Promise<KycRecord> {
    const pending = await this.prisma.kycRecord.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException('A KYC submission is already pending review');
    }

    const idNumberEncrypted = this.crypto.encrypt(params.idNumber);
    const record = await this.prisma.kycRecord.create({
      data: {
        userId,
        idType: params.idType,
        idNumberEncrypted,
        status: 'PENDING',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus: 'PENDING' },
    });

    return record;
  }

  async getLatestForUser(userId: string): Promise<KycRecord | null> {
    return this.prisma.kycRecord.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------------------

  async listForAdmin(status?: KycStatus): Promise<AdminKycRecordView[]> {
    const records = await this.prisma.kycRecord.findMany({
      where: status ? { status } : undefined,
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((record) => this.toAdminView(record, record.user));
  }

  async approve(
    adminId: string,
    kycRecordId: string,
  ): Promise<AdminKycRecordView> {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.kycRecord.findUnique({
        where: { id: kycRecordId },
        include: { user: true },
      });
      if (!record) throw new NotFoundException('KYC submission not found');
      if (record.status !== 'PENDING') {
        throw new ConflictException(
          `Can't approve — this submission is ${describeStatus(record.status)}.`,
        );
      }

      const updatedRecord = await tx.kycRecord.update({
        where: { id: kycRecordId },
        data: {
          status: 'APPROVED',
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: record.userId },
        data: {
          kycStatus: 'APPROVED',
          // Only lifts PENDING_KYC -> ACTIVE. A suspended/banned account stays that way —
          // reinstating it is a separate, deliberate admin action, not a side effect of KYC.
          status:
            record.user.status === 'PENDING_KYC'
              ? 'ACTIVE'
              : record.user.status,
        },
      });

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'KYC_APPROVED',
          targetEntityType: 'KycRecord',
          targetEntityId: kycRecordId,
          reason: 'Identity verification approved after review',
          beforeState: {
            kycRecordStatus: record.status,
            userStatus: record.user.status,
          },
          afterState: {
            kycRecordStatus: updatedRecord.status,
            userStatus: updatedUser.status,
          },
        },
        tx,
      );

      return this.toAdminView(updatedRecord, updatedUser);
    });
  }

  async reject(
    adminId: string,
    kycRecordId: string,
    reason: string,
  ): Promise<AdminKycRecordView> {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.kycRecord.findUnique({
        where: { id: kycRecordId },
        include: { user: true },
      });
      if (!record) throw new NotFoundException('KYC submission not found');
      if (record.status !== 'PENDING') {
        throw new ConflictException(
          `Can't reject — this submission is ${describeStatus(record.status)}.`,
        );
      }

      const updatedRecord = await tx.kycRecord.update({
        where: { id: kycRecordId },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: record.userId },
        data: { kycStatus: 'REJECTED' },
      });

      await this.auditLog.record(
        {
          adminUserId: adminId,
          actionType: 'KYC_REJECTED',
          targetEntityType: 'KycRecord',
          targetEntityId: kycRecordId,
          reason,
          beforeState: { kycRecordStatus: record.status },
          afterState: { kycRecordStatus: updatedRecord.status },
        },
        tx,
      );

      return this.toAdminView(updatedRecord, updatedUser);
    });
  }

  private toAdminView(record: KycRecord, user: User): AdminKycRecordView {
    return {
      id: record.id,
      userId: record.userId,
      userFullName: user.fullName,
      userPhone: user.phone,
      idType: record.idType,
      idNumber: this.crypto.decrypt(record.idNumberEncrypted),
      status: record.status,
      rejectionReason: record.rejectionReason,
      createdAt: record.createdAt,
    };
  }
}

function describeStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}
