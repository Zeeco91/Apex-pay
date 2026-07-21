import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { Env } from '../../config/env.validation';
import type { EmailProvider } from './email-provider.interface';

/**
 * Real email delivery via AWS SES. Selected by EmailModule whenever AWS_SES_ACCESS_KEY_ID is
 * set, taking priority over Resend — chosen over Resend as an interim provider specifically
 * because SES's sandbox mode lets you verify individual recipient addresses (Resend's sandbox
 * only ever allows the account owner's own email, with no way to add others short of full
 * domain verification).
 */
@Injectable()
export class SesEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SesEmailProvider.name);
  private readonly client: SESv2Client;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.client = new SESv2Client({
      region: this.config.get('AWS_SES_REGION', { infer: true }),
      credentials: {
        accessKeyId: this.config.get('AWS_SES_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: this.config.get('AWS_SES_SECRET_ACCESS_KEY', {
          infer: true,
        }),
      },
    });
  }

  async sendOtp(email: string, code: string): Promise<void> {
    const from = this.config.get('EMAIL_FROM', { infer: true });
    const ttlMinutes = this.config.get('OTP_TTL_MINUTES', { infer: true });

    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [email] },
          Content: {
            Simple: {
              Subject: { Data: `${code} is your APEX PAY verification code` },
              Body: {
                Html: {
                  Data: `<p>Your APEX PAY verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>This code expires in ${ttlMinutes} minutes. If you didn't request this, you can ignore this email.</p>`,
                },
              },
            },
          },
        }),
      );
    } catch (err) {
      this.logger.error(
        `AWS SES failed to send OTP email: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new Error(
        'Failed to send verification email — please try again shortly.',
      );
    }
  }
}
