import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import type { KycStatus, User, UserRole, UserStatus } from '@prisma/client';

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids user transcription errors

export type PublicUser = Omit<User, 'pinHash' | 'deviceFingerprints'>;

export interface PayoutBankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  [key: string]: string;
}

/** Explicit allow-list rather than destructuring-out pinHash — if a future sensitive
 * field is added to User, it has to be deliberately added here to reach the client. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    phone: user.phone,
    phoneVerifiedAt: user.phoneVerifiedAt,
    fullName: user.fullName,
    referralCode: user.referralCode,
    referredByUserId: user.referredByUserId,
    role: user.role,
    status: user.status,
    kycStatus: user.kycStatus,
    payoutBankDetails: user.payoutBankDetails,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export interface AdminUserSummary {
  id: string;
  phone: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  referralCode: string;
  referredByUserId: string | null;
  payoutBankDetails: PayoutBankDetails | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

const SUSPENDABLE_STATUSES: UserStatus[] = ['ACTIVE', 'PENDING_KYC'];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByReferralCode(referralCode: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { referralCode } });
  }

  async createUser(params: {
    phone: string;
    fullName: string;
    pinHash: string;
    referredByUserId?: string | null;
  }): Promise<User> {
    const referralCode = await this.generateUniqueReferralCode();
    return this.prisma.user.create({
      data: {
        phone: params.phone,
        fullName: params.fullName,
        pinHash: params.pinHash,
        referralCode,
        referredByUserId: params.referredByUserId ?? null,
        phoneVerifiedAt: new Date(),
      },
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async updatePin(userId: string, pinHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { pinHash } });
  }

  async updatePayoutBankDetails(
    userId: string,
    details: PayoutBankDetails,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { payoutBankDetails: details },
    });
  }

  // ---------------------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------------------

  async listForAdmin(filters: {
    status?: UserStatus;
    kycStatus?: KycStatus;
    search?: string;
  }): Promise<AdminUserSummary[]> {
    const users = await this.prisma.user.findMany({
      where: {
        status: filters.status,
        kycStatus: filters.kycStatus,
        ...(filters.search
          ? {
              OR: [
                { phone: { contains: filters.search, mode: 'insensitive' } },
                { fullName: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(toAdminSummary);
  }

  async getForAdmin(userId: string): Promise<AdminUserSummary> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return toAdminSummary(user);
  }

  async suspendUser(
    adminId: string,
    userId: string,
    reason: string,
  ): Promise<AdminUserSummary> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!SUSPENDABLE_STATUSES.includes(user.status)) {
      throw new ConflictException(
        `Can't suspend — this account is already ${describeStatus(user.status)}.`,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });
    await this.auditLog.record({
      adminUserId: adminId,
      actionType: 'USER_SUSPENDED',
      targetEntityType: 'User',
      targetEntityId: userId,
      reason,
      beforeState: { status: user.status },
      afterState: { status: updated.status },
    });
    return toAdminSummary(updated);
  }

  async banUser(
    adminId: string,
    userId: string,
    reason: string,
  ): Promise<AdminUserSummary> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === 'BANNED') {
      throw new ConflictException('This account is already banned.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'BANNED' },
    });
    await this.auditLog.record({
      adminUserId: adminId,
      actionType: 'USER_BANNED',
      targetEntityType: 'User',
      targetEntityId: userId,
      reason,
      beforeState: { status: user.status },
      afterState: { status: updated.status },
    });
    return toAdminSummary(updated);
  }

  async reinstateUser(
    adminId: string,
    userId: string,
    reason?: string,
  ): Promise<AdminUserSummary> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'SUSPENDED' && user.status !== 'BANNED') {
      throw new ConflictException(
        `Can't reinstate — this account is ${describeStatus(user.status)}, not suspended or banned.`,
      );
    }

    // KYC approval, not admin discretion, is what actually unlocks queue participation — a
    // reinstated user without approved KYC lands back at PENDING_KYC, not ACTIVE.
    const nextStatus: UserStatus =
      user.kycStatus === 'APPROVED' ? 'ACTIVE' : 'PENDING_KYC';
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: nextStatus },
    });
    await this.auditLog.record({
      adminUserId: adminId,
      actionType: 'USER_REINSTATED',
      targetEntityType: 'User',
      targetEntityId: userId,
      reason: reason ?? 'No reason provided',
      beforeState: { status: user.status },
      afterState: { status: updated.status },
    });
    return toAdminSummary(updated);
  }

  private async generateUniqueReferralCode(): Promise<string> {
    // Collision odds are astronomically low (32^8 keyspace) but a real DB round-trip
    // check costs nothing at this scale and removes any doubt.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomAlphabetString(REFERRAL_CODE_ALPHABET, 8);
      const existing = await this.findByReferralCode(code);
      if (!existing) return code;
    }
    throw new Error(
      'Failed to generate a unique referral code after 5 attempts',
    );
  }
}

function randomAlphabetString(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

function toAdminSummary(user: User): AdminUserSummary {
  return {
    id: user.id,
    phone: user.phone,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    kycStatus: user.kycStatus,
    referralCode: user.referralCode,
    referredByUserId: user.referredByUserId,
    payoutBankDetails: user.payoutBankDetails as PayoutBankDetails | null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function describeStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}
