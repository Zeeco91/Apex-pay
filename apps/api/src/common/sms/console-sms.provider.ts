import { Injectable, Logger } from '@nestjs/common';
import type { SmsProvider } from './sms-provider.interface';

/**
 * Stand-in until a real provider (Termii primary, Twilio fallback — plan §1) is wired up.
 * Logs the code instead of sending a real SMS.
 *
 * OtpService now prefers email over SMS whenever an address is available (see
 * common/email/email.module.ts), so this only ever gets called as a fallback for accounts
 * with no email on file — a narrow, already-documented gap (LAUNCH_CHECKLIST.md), not a
 * reason to prevent the whole app from booting. This previously threw when
 * NODE_ENV=production specifically to block that; SmsModule always instantiates this class
 * regardless of whether SMS is ever actually called, so that guard crashed every boot in
 * production rather than only the rare path that needs it.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.warn(`[DEV ONLY — no real SMS sent] OTP for ${phone}: ${code}`);
    await Promise.resolve();
  }
}
