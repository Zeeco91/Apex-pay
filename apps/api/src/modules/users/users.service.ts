import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { User } from '@prisma/client';

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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
