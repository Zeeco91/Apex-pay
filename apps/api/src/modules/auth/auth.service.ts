import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { OtpPurpose } from '@prisma/client';
import {
  UsersService,
  toPublicUser,
  type PublicUser,
} from '../users/users.service';
import { OtpService } from './otp.service';
import { TokenService, type IssuedTokens } from './token.service';
import { MfaService } from './mfa.service';
import { normalizePhoneOrThrow } from '../../common/phone/phone.util';

const OTP_PROOF_VALIDITY_MINUTES = 15;

export interface RequestMeta {
  ipAddress?: string;
  deviceInfo?: string;
}

export type LoginResult =
  | { mfaRequired: true; mfaPendingToken: string }
  | { mfaRequired: false; user: PublicUser; tokens: IssuedTokens };

export type { PublicUser };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly mfaService: MfaService,
  ) {}

  async requestOtp(
    rawPhone: string,
    purpose: OtpPurpose,
    meta: RequestMeta,
    email?: string,
  ): Promise<void> {
    const phone = normalizePhoneOrThrow(rawPhone);
    await this.otpService.requestOtp(phone, purpose, meta.ipAddress, email);
  }

  async verifyOtp(
    rawPhone: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    const phone = normalizePhoneOrThrow(rawPhone);
    await this.otpService.verifyOtp(phone, purpose, code);
  }

  async register(
    params: {
      phone: string;
      email: string;
      fullName: string;
      pin: string;
      referralCode?: string;
    },
    meta: RequestMeta,
  ): Promise<{ user: PublicUser; tokens: IssuedTokens }> {
    const phone = normalizePhoneOrThrow(params.phone);

    const otpVerified = await this.otpService.hasRecentVerifiedOtp(
      phone,
      'REGISTER',
      OTP_PROOF_VALIDITY_MINUTES,
    );
    if (!otpVerified) {
      throw new UnauthorizedException(
        'Phone verification required before registering',
      );
    }

    const existing = await this.usersService.findByPhone(phone);
    if (existing) {
      throw new ConflictException(
        'An account with this phone number already exists',
      );
    }

    const existingEmail = await this.usersService.findByEmail(params.email);
    if (existingEmail) {
      throw new ConflictException(
        'An account with this email address already exists',
      );
    }

    let referredByUserId: string | null = null;
    if (params.referralCode) {
      const referrer = await this.usersService.findByReferralCode(
        params.referralCode,
      );
      if (!referrer) {
        throw new ConflictException('Invalid referral code');
      }
      referredByUserId = referrer.id;
    }

    const pinHash = await argon2.hash(params.pin, { type: argon2.argon2id });
    const user = await this.usersService.createUser({
      phone,
      email: params.email,
      fullName: params.fullName,
      pinHash,
      referredByUserId,
    });

    const tokens = await this.tokenService.issueTokens(user, meta);
    return { user: toPublicUser(user), tokens };
  }

  async login(
    params: { phone: string; pin: string },
    meta: RequestMeta,
  ): Promise<LoginResult> {
    const phone = normalizePhoneOrThrow(params.phone);
    const user = await this.usersService.findByPhone(phone);

    // Same generic message whether the phone or PIN was wrong — don't help an attacker enumerate accounts.
    const invalidCredentials = () =>
      new UnauthorizedException('Invalid phone number or PIN');

    if (!user) throw invalidCredentials();
    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException(
        'This account is not active — contact support',
      );
    }
    if (this.usersService.isPinLocked(user)) {
      throw new HttpException(
        'Too many failed PIN attempts. Please try again in 15 minutes, or reset your PIN.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const pinValid = await argon2.verify(user.pinHash, params.pin);
    if (!pinValid) {
      await this.usersService.recordFailedPinAttempt(user.id);
      throw invalidCredentials();
    }
    await this.usersService.resetPinAttempts(user.id);

    if (user.mfaEnabled) {
      // PIN alone was correct, but a second factor is still required before real session
      // tokens are issued — updateLastLogin/issueTokens happen only in verifyMfaAndLogin below.
      return {
        mfaRequired: true,
        mfaPendingToken: this.mfaService.issuePendingToken(user.id),
      };
    }

    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.tokenService.issueTokens(user, meta);
    return { mfaRequired: false, user: toPublicUser(user), tokens };
  }

  async verifyMfaAndLogin(
    mfaPendingToken: string,
    code: string,
    meta: RequestMeta,
  ): Promise<{ user: PublicUser; tokens: IssuedTokens }> {
    const userId = this.mfaService.verifyPendingToken(mfaPendingToken);
    const codeValid = await this.mfaService.verifyCodeForUser(userId, code);
    if (!codeValid) {
      throw new UnauthorizedException('Invalid or expired code.');
    }

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Account no longer exists.');

    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.tokenService.issueTokens(user, meta);
    return { user: toPublicUser(user), tokens };
  }

  async refresh(
    rawRefreshToken: string,
    meta: RequestMeta,
  ): Promise<IssuedTokens> {
    return this.tokenService.rotateRefreshToken(rawRefreshToken, meta);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(rawRefreshToken);
  }

  async requestPinReset(rawPhone: string, meta: RequestMeta): Promise<void> {
    const phone = normalizePhoneOrThrow(rawPhone);
    // Always succeeds from the caller's perspective even if the phone isn't registered —
    // otherwise this endpoint becomes an account-existence oracle.
    const user = await this.usersService.findByPhone(phone);
    if (user) {
      // Uses whatever email is already on file, if any — never asks the client to supply one,
      // so this can't be used to overwrite/probe an account's registered email.
      await this.otpService.requestOtp(
        phone,
        'PIN_RESET',
        meta.ipAddress,
        user.email ?? undefined,
      );
    }
  }

  async confirmPinReset(params: {
    phone: string;
    code: string;
    newPin: string;
  }): Promise<void> {
    const phone = normalizePhoneOrThrow(params.phone);
    await this.otpService.verifyOtp(phone, 'PIN_RESET', params.code);

    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      // OTP verification against a non-existent phone should never happen (requestPinReset
      // only sends codes for real accounts) — treat it as an integrity problem, not a 404 leak.
      throw new UnauthorizedException('Unable to reset PIN for this number');
    }

    const pinHash = await argon2.hash(params.newPin, { type: argon2.argon2id });
    await this.usersService.updatePin(user.id, pinHash);
    await this.usersService.resetPinAttempts(user.id);
    // Force re-login everywhere after a security-sensitive PIN reset.
    await this.tokenService.revokeAllForUser(user.id);
  }
}
