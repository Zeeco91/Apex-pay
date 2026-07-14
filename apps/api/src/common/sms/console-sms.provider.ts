import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import type { SmsProvider } from './sms-provider.interface';

/**
 * Dev-only stand-in until a real provider (Termii primary, Twilio fallback — plan §1)
 * is wired up. Logs the code instead of sending a real SMS.
 *
 * Refuses to run in production so nobody ships this by accident believing OTPs
 * are actually being delivered.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  constructor(config: ConfigService<Env, true>) {
    if (config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new Error(
        'ConsoleSmsProvider must never run in production — wire a real SmsProvider (Termii/Twilio) first.',
      );
    }
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.warn(`[DEV ONLY — no real SMS sent] OTP for ${phone}: ${code}`);
    await Promise.resolve();
  }
}
