import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleEmailProvider } from './console-email.provider';
import { ResendEmailProvider } from './resend-email.provider';
import { SesEmailProvider } from './ses-email.provider';
import { EMAIL_PROVIDER } from './email-provider.interface';
import type { Env } from '../../config/env.validation';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    ConsoleEmailProvider,
    ResendEmailProvider,
    SesEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      // SES takes priority over Resend when both are configured — chosen as the interim
      // provider specifically because its sandbox mode allows verifying individual recipient
      // addresses (Resend's sandbox only ever allows the account's own email). Refuses to boot
      // in production with neither configured, so nobody ships this believing OTPs are
      // actually being delivered (mirrors ConsoleSmsProvider's equivalent guard).
      inject: [
        ConfigService,
        ConsoleEmailProvider,
        ResendEmailProvider,
        SesEmailProvider,
      ],
      useFactory: (
        config: ConfigService<Env, true>,
        consoleProvider: ConsoleEmailProvider,
        resendProvider: ResendEmailProvider,
        sesProvider: SesEmailProvider,
      ) => {
        if (config.get('AWS_SES_ACCESS_KEY_ID', { infer: true }))
          return sesProvider;
        if (config.get('RESEND_API_KEY', { infer: true }))
          return resendProvider;
        if (config.get('NODE_ENV', { infer: true }) === 'production') {
          throw new Error(
            'AWS_SES_ACCESS_KEY_ID or RESEND_API_KEY must be set in production — no OTP email provider configured.',
          );
        }
        return consoleProvider;
      },
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
