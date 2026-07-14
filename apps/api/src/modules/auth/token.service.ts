import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../config/env.validation';

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  role: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  signAccessToken(user: Pick<User, 'id' | 'phone' | 'role'>): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  /** Issues a fresh access+refresh pair and persists the refresh token's hash (never the raw value). */
  async issueTokens(
    user: Pick<User, 'id' | 'phone' | 'role'>,
    meta: { deviceInfo?: string; ipAddress?: string },
  ): Promise<IssuedTokens> {
    const accessToken = this.signAccessToken(user);
    const rawRefreshToken = randomBytes(64).toString('hex');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60_000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        deviceInfo: meta.deviceInfo,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  /**
   * Validates a raw refresh token, rotates it (old one revoked, new one issued), and returns
   * a fresh token pair for the owning user.
   *
   * Reuse detection: a revoked-but-presented token is treated as a signal of possible theft —
   * every active refresh token for that user is revoked, forcing a full re-login everywhere.
   */
  async rotateRefreshToken(
    rawRefreshToken: string,
    meta: { deviceInfo?: string; ipAddress?: string },
  ): Promise<IssuedTokens> {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid session — please log in again');
    }

    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session invalid — please log in again');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired — please log in again');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(existing.user, meta);
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(rawToken: string): string {
  // Refresh tokens are 512 bits of CSPRNG entropy — a fast hash is fine here (unlike PINs,
  // there's no risk of a feasible dictionary/brute-force attack against the stored hash).
  return createHash('sha256').update(rawToken).digest('hex');
}
