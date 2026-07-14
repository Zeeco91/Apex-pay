import {
  Body,
  Controller,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPinResetDto } from './dto/request-pin-reset.dto';
import { PinResetConfirmDto } from './dto/pin-reset-confirm.dto';
import type { Env } from '../../config/env.validation';
import type { IssuedTokens } from './token.service';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('otp/request')
  async requestOtp(
    @Body() dto: RequestOtpDto,
    @Ip() ip: string,
  ): Promise<{ success: true }> {
    await this.authService.requestOtp(dto.phone, dto.purpose, {
      ipAddress: ip,
    });
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

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.login(dto, {
      ipAddress: ip,
      deviceInfo: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, tokens);
    return { success: true, data: { user, accessToken: tokens.accessToken } };
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
