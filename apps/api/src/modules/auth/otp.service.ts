import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { OtpPurpose } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SMS_PROVIDER,
  type SmsProvider,
} from '../../common/sms/sms-provider.interface';
import type { Env } from '../../config/env.validation';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async requestOtp(
    phone: string,
    purpose: OtpPurpose,
    ipAddress?: string,
  ): Promise<void> {
    const cooldownSeconds = this.config.get('OTP_REQUEST_COOLDOWN_SECONDS', {
      infer: true,
    });
    const windowMinutes = this.config.get('OTP_REQUEST_WINDOW_MINUTES', {
      infer: true,
    });
    const maxPerWindow = this.config.get('OTP_REQUEST_MAX_PER_WINDOW', {
      infer: true,
    });
    const ttlMinutes = this.config.get('OTP_TTL_MINUTES', { infer: true });

    const windowStart = new Date(Date.now() - windowMinutes * 60_000);
    const recent = await this.prisma.otpCode.findMany({
      where: { phone, purpose, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'desc' },
    });

    if (recent.length > 0) {
      const secondsSinceLast =
        (Date.now() - recent[0].createdAt.getTime()) / 1000;
      if (secondsSinceLast < cooldownSeconds) {
        throw new HttpException(
          `Please wait ${Math.ceil(cooldownSeconds - secondsSinceLast)}s before requesting another code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    if (recent.length >= maxPerWindow) {
      throw new HttpException(
        `Too many code requests for this number. Try again in ${windowMinutes} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = this.hashCode(code);

    await this.prisma.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash,
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        ipAddress,
      },
    });

    await this.smsProvider.sendOtp(phone, code);
    this.logger.log(`OTP requested for ${purpose} (phone redacted)`);
  }

  /** Verifies and — on success — consumes the code. Throws on any failure. */
  async verifyOtp(
    phone: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    const maxAttempts = this.config.get('OTP_MAX_ATTEMPTS', { infer: true });

    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException(
        'No active code found for this number — request a new one',
      );
    }

    if (otp.attemptCount >= maxAttempts) {
      throw new HttpException(
        'Too many incorrect attempts — request a new code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isMatch = this.compareCode(code, otp.codeHash);
    if (!isMatch) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect code');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }

  /** Proof that `phone` completed OTP verification for `purpose` recently — used by register/pin-reset-confirm. */
  async hasRecentVerifiedOtp(
    phone: string,
    purpose: OtpPurpose,
    withinMinutes: number,
  ): Promise<boolean> {
    const since = new Date(Date.now() - withinMinutes * 60_000);
    const verified = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: { gte: since } },
      orderBy: { consumedAt: 'desc' },
    });
    return verified !== null;
  }

  private hashCode(code: string): string {
    const secret = this.config.get('OTP_HMAC_SECRET', { infer: true });
    return createHmac('sha256', secret).update(code).digest('hex');
  }

  private compareCode(code: string, storedHash: string): boolean {
    const candidateHash = Buffer.from(this.hashCode(code), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    if (candidateHash.length !== stored.length) return false;
    return timingSafeEqual(candidateHash, stored);
  }
}
