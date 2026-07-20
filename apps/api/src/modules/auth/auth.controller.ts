import {
  Body,
  Controller,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPinResetDto } from './dto/request-pin-reset.dto';
import { PinResetConfirmDto } from './dto/pin-reset-confirm.dto';
import { MfaCodeDto } from './dto/mfa-code.dto';
import { MfaLoginVerifyDto } from './dto/mfa-login-verify.dto';
import { LOGIN_THROTTLE_LIMIT } from '../../common/throttle.constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import type { Env } from '../../config/env.validation';
import type { IssuedTokens } from './token.service';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('otp/request')
  async requestOtp(
    @Body() dto: RequestOtpDto,
    @Ip() ip: string,
  ): Promise<{ success: true }> {
    await this.authService.requestOtp(
      dto.phone,
      dto.purpose,
      { ipAddress: ip },
      dto.email,
    );
    return { success: true };
  }

  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<{ success: true }> {
    await this.authService.verifyOtp(dto.phone, dto.purpose, dto.code);
    return { success: true };
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.register(dto, {
      ipAddress: ip,
      deviceInfo: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, tokens);
    return { success: true, data: { user, accessToken: tokens.accessToken } };
  }

  // Backs up the per-account lockout in AuthService — this bounds how many attempts an
  // attacker can spray across many different accounts from one IP before that IP itself
  // gets throttled, tighter than the global default (20/min) given the small 4-digit PIN
  // keyspace.
  @Throttle({ default: { limit: LOGIN_THROTTLE_LIMIT, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      ipAddress: ip,
      deviceInfo: req.headers['user-agent'],
    });
    if (result.mfaRequired) {
      return {
        success: true,
        data: { mfaRequired: true, mfaPendingToken: result.mfaPendingToken },
      };
    }
    this.setRefreshCookie(res, result.tokens);
    return {
      success: true,
      data: {
        mfaRequired: false,
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    };
  }

  @Throttle({ default: { limit: LOGIN_THROTTLE_LIMIT, ttl: 60_000 } })
  @Post('mfa/login-verify')
  async mfaLoginVerify(
    @Body() dto: MfaLoginVerifyDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.verifyMfaAndLogin(
      dto.mfaPendingToken,
      dto.code,
      { ipAddress: ip, deviceInfo: req.headers['user-agent'] },
    );
    this.setRefreshCookie(res, tokens);
    return { success: true, data: { user, accessToken: tokens.accessToken } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  async beginMfaSetup(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.mfaService.beginSetup(user.id, user.phone);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/verify-setup')
  async confirmMfaSetup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaCodeDto,
  ): Promise<{ success: true }> {
    await this.mfaService.confirmSetup(user.id, dto.code);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/disable')
  async disableMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaCodeDto,
  ): Promise<{ success: true }> {
    await this.mfaService.disable(user.id, dto.code);
    return { success: true };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = this.getRefreshCookie(req);
    const tokens = await this.authService.refresh(rawRefreshToken, {
      ipAddress: ip,
      deviceInfo: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, tokens);
    return { success: true, data: { accessToken: tokens.accessToken } };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as
      string | undefined;
    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    return { success: true };
  }

  @Post('pin/reset/request')
  async requestPinReset(
    @Body() dto: RequestPinResetDto,
    @Ip() ip: string,
  ): Promise<{ success: true }> {
    await this.authService.requestPinReset(dto.phone, { ipAddress: ip });
    return { success: true };
  }

  @Throttle({ default: { limit: LOGIN_THROTTLE_LIMIT, ttl: 60_000 } })
  @Post('pin/reset/confirm')
  async confirmPinReset(
    @Body() dto: PinResetConfirmDto,
  ): Promise<{ success: true }> {
    await this.authService.confirmPinReset(dto);
    return { success: true };
  }

  private getRefreshCookie(req: Request): string {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('No session found — please log in again');
    }
    return token;
  }

  private setRefreshCookie(res: Response, tokens: IssuedTokens): void {
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      expires: tokens.refreshTokenExpiresAt,
    });
  }
}
