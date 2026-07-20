import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import type { EmailProvider } from './email-provider.interface';

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Real email delivery via Resend's REST API (plain fetch — Node 18+ has it built in, so this
 * avoids adding the `resend` package as a dependency just for one endpoint call). Selected by
 * EmailModule whenever RESEND_API_KEY is set, in any environment — see email.module.ts.
 */
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendOtp(email: string, code: string): Promise<void> {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    const from = this.config.get('EMAIL_FROM', { infer: true });
    const ttlMinutes = this.config.get('OTP_TTL_MINUTES', { infer: true });

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${code} is your APEX PAY verification code`,
        html: `<p>Your APEX PAY verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>This code expires in ${ttlMinutes} minutes. If you didn't request this, you can ignore this email.</p>`,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(
        `Resend API returned ${response.status} while sending OTP email: ${body}`,
      );
      throw new Error(
        'Failed to send verification email — please try again shortly.',
      );
    }
  }
}
