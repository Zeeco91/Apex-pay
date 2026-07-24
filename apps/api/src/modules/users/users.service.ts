import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import type { User, UserRole, UserStatus } from '@prisma/client';

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids user transcription errors

// Brute-force protection for PIN login (plan §10) — backs up the per-IP throttle on the login
// route with a per-account lock, since a 4-digit PIN's keyspace is small enough that a
// distributed/rotating-IP attacker could otherwise bypass IP-based rate limiting entirely.
const MAX_FAILED_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 15;

export type PublicUser = Omit<
  User,
  | 'pinHash'
  | 'deviceFingerprints'
  | 'mfaSecret'
  | 'failedPinAttempts'
  | 'pinLockedUntil'
>;

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
    email: user.email,
    fullName: user.fullName,
    referralCode: user.referralCode,
    referredByUserId: user.referredByUserId,
    role: user.role,
    status: user.status,
    payoutBankDetails: user.payoutBankDetails,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

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
  createdAt: Date;
  lastLoginAt: Date | null;
}

const SUSPENDABLE_STATUSES: UserStatus[] = ['ACTIVE'];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByReferralCode(referralCode: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { referralCode } });
  }

  async createUser(params: {
    phone: string;
    email: string;
    fullName: string;
    pinHash: string;
    referredByUserId?: string | null;
  }): Promise<User> {
    const referralCode = await this.generateUniqueReferralCode();
    return this.prisma.user.create({
      data: {
        phone: params.phone,
        email: params.email,
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

  isPinLocked(user: Pick<User, 'pinLockedUntil'>): boolean {
    return !!user.pinLockedUntil && user.pinLockedUntil > new Date();
  }

  /** Call after a failed PIN attempt. Locks the account once the threshold is reached. */
  async recordFailedPinAttempt(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { failedPinAttempts: true },
    });
    const attempts = user.failedPinAttempts + 1;
    const lockingNow = attempts >= MAX_FAILED_PIN_ATTEMPTS;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedPinAttempts: lockingNow ? 0 : attempts,
        pinLockedUntil: lockingNow
          ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000)
          : undefined,
      },
    });
  }

  /** Call after a successful PIN check to clear any accumulated failure count. */
  async resetPinAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedPinAttempts: 0, pinLockedUntil: null },
    });
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
    role?: UserRole;
    search?: string;
  }): Promise<AdminUserSummary[]> {
    const users = await this.prisma.user.findMany({
      where: {
        status: filters.status,
        role: filters.role,
        ...(filters.search
          ? {
              OR: [
                { phone: { contains: filters.search, mode: 'insensitive' } },
                { fullName: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
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

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
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
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
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
