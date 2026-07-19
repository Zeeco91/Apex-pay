import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Heuristic thresholds, not proof of fraud — see plan §10: "Referral fraud mitigations are
// heuristic, not absolute... ongoing human review remains necessary." These flags exist to
// direct that human review, not to auto-block anyone.
const REFERRAL_BURST_THRESHOLD = 5;
const REFERRAL_BURST_WINDOW_HOURS = 24;

interface FlaggedUser {
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
  windowStart: Date;
  referredCount: number;
  referredUsers: FlaggedUser[];
}

export interface FraudFlagsSummary {
  sharedBankDetails: SharedBankDetailsFlag[];
  referralBursts: ReferralBurstFlag[];
}

interface PayoutBankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

@Injectable()
export class FraudFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFlags(): Promise<FraudFlagsSummary> {
    const [sharedBankDetails, referralBursts] = await Promise.all([
      this.detectSharedBankDetails(),
      this.detectReferralBursts(),
    ]);
    return { sharedBankDetails, referralBursts };
  }

  /**
   * Multiple distinct accounts pointing payouts at the same bank account number is a strong
   * self-referral signal (one person farming referral bonuses across fake identities) —
   * unlike device fingerprints (never actually captured at signup in this codebase — see
   * User.deviceFingerprints), this is derivable from data that genuinely exists.
   */
  private async detectSharedBankDetails(): Promise<SharedBankDetailsFlag[]> {
    const users = await this.prisma.user.findMany({
      where: { payoutBankDetails: { not: Prisma.DbNull } },
      select: {
        id: true,
        fullName: true,
        phone: true,
        payoutBankDetails: true,
      },
    });

    const byAccountNumber = new Map<
      string,
      { bankName: string; users: FlaggedUser[] }
    >();
    for (const user of users) {
      const details = user.payoutBankDetails as unknown as PayoutBankDetails;
      if (!details?.accountNumber) continue;
      const existing = byAccountNumber.get(details.accountNumber);
      const flaggedUser = {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
      };
      if (existing) {
        existing.users.push(flaggedUser);
      } else {
        byAccountNumber.set(details.accountNumber, {
          bankName: details.bankName,
          users: [flaggedUser],
        });
      }
    }

    return Array.from(byAccountNumber.entries())
      .filter(([, group]) => group.users.length > 1)
      .map(([accountNumber, group]) => ({
        accountNumber,
        bankName: group.bankName,
        users: group.users,
      }));
  }

  /** An unusually large number of referred signups from one referrer within a short window. */
  private async detectReferralBursts(): Promise<ReferralBurstFlag[]> {
    const referred = await this.prisma.user.findMany({
      where: { referredByUserId: { not: null } },
      select: {
        id: true,
        fullName: true,
        phone: true,
        createdAt: true,
        referredByUserId: true,
        referredBy: { select: { id: true, fullName: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byReferrer = new Map<string, typeof referred>();
    for (const user of referred) {
      const key = user.referredByUserId!;
      const list = byReferrer.get(key) ?? [];
      list.push(user);
      byReferrer.set(key, list);
    }

    const windowMs = REFERRAL_BURST_WINDOW_HOURS * 60 * 60 * 1000;
    const flags: ReferralBurstFlag[] = [];

    for (const group of byReferrer.values()) {
      // Sliding window over this referrer's referred signups, sorted ascending — as soon as a
      // window of size >= threshold is found, flag it and move past that window entirely rather
      // than reporting every overlapping sub-window for the same burst.
      let windowStartIndex = 0;
      let i = 0;
      while (i < group.length) {
        while (
          group[i].createdAt.getTime() -
            group[windowStartIndex].createdAt.getTime() >
          windowMs
        ) {
          windowStartIndex++;
        }
        const windowSize = i - windowStartIndex + 1;
        if (windowSize >= REFERRAL_BURST_THRESHOLD) {
          const windowUsers = group.slice(windowStartIndex, i + 1);
          flags.push({
            referrer: windowUsers[0].referredBy!,
            windowStart: windowUsers[0].createdAt,
            referredCount: windowUsers.length,
            referredUsers: windowUsers.map((u) => ({
              id: u.id,
              fullName: u.fullName,
              phone: u.phone,
            })),
          });
          windowStartIndex = i + 1;
        }
        i++;
      }
    }

    return flags;
  }
}
