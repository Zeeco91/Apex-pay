import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider } from './email-provider.interface';

/**
 * Dev-only stand-in for when no RESEND_API_KEY is configured — mirrors
 * ../sms/console-sms.provider.ts. Logs the code instead of sending a real email.
 *
 * Both this and ResendEmailProvider are always constructed (EmailModule's factory injects
 * both and picks one), so the "never in production without a key" guard lives in the
 * factory itself, not here — a guard in this constructor would throw at boot even when
 * Resend is the one actually selected.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async sendOtp(email: string, code: string): Promise<void> {
    this.logger.warn(
      `[DEV ONLY — no real email sent] OTP for ${email}: ${code}`,
    );
    await Promise.resolve();
  }
}
