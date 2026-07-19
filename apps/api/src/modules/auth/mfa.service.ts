import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateSecret, generateURI, verify } from 'otplib';
import { CryptoService } from '../../common/crypto/crypto.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../config/env.validation';

const MFA_ISSUER = 'Apex Pay';
const MFA_PENDING_TOKEN_TTL = '5m';
const MFA_PENDING_PURPOSE = 'mfa_pending';

interface MfaPendingPayload {
  sub: string;
  purpose: typeof MFA_PENDING_PURPOSE;
}

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Generates a new TOTP secret and stores it (encrypted) against the account, but does NOT
   * enable MFA yet — that only happens once confirmSetup proves the admin actually captured it
   * in an authenticator app, so a setup call that's abandoned mid-flow can't silently half-enable
   * anything.
   */
  async beginSetup(
    userId: string,
    phone: string,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const secret = generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: this.crypto.encrypt(secret) },
    });
    const otpauthUrl = generateURI({
      issuer: MFA_ISSUER,
      label: phone,
      secret,
    });
    return { secret, otpauthUrl };
  }

  async confirmSetup(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });
    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled on this account.');
    }
    if (
      !user.mfaSecret ||
      !(await this.verifyAgainstSecret(user.mfaSecret, code))
    ) {
      throw new UnauthorizedException('Invalid or expired code.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
  }

  /** Disabling requires a currently-valid code — a stolen session alone can't turn MFA off. */
  async disable(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new ConflictException('MFA is not enabled on this account.');
    }
    if (!(await this.verifyAgainstSecret(user.mfaSecret, code))) {
      throw new UnauthorizedException('Invalid or expired code.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
  }

  async verifyCodeForUser(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaSecret: true },
    });
    return (
      !!user.mfaSecret && (await this.verifyAgainstSecret(user.mfaSecret, code))
    );
  }

  /** Short-lived, single-purpose token exchanged for real session tokens once the TOTP code
   * checks out — deliberately cannot be used to call any authenticated route on its own. */
  issuePendingToken(userId: string): string {
    const payload: MfaPendingPayload = {
      sub: userId,
      purpose: MFA_PENDING_PURPOSE,
    };
    return this.jwtService.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: MFA_PENDING_TOKEN_TTL,
    });
  }

  verifyPendingToken(token: string): string {
    let payload: MfaPendingPayload;
    try {
      payload = this.jwtService.verify<MfaPendingPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException(
        'MFA session expired — please log in again.',
      );
    }
    if (payload.purpose !== MFA_PENDING_PURPOSE) {
      throw new UnauthorizedException('Invalid MFA session.');
    }
    return payload.sub;
  }

  private async verifyAgainstSecret(
    encryptedSecret: string,
    code: string,
  ): Promise<boolean> {
    const secret = this.crypto.decrypt(encryptedSecret);
    const result = await verify({ secret, token: code });
    return result.valid;
  }
}
