import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleEmailProvider } from './console-email.provider';
import { ResendEmailProvider } from './resend-email.provider';
import { EMAIL_PROVIDER } from './email-provider.interface';
import type { Env } from '../../config/env.validation';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    ConsoleEmailProvider,
    ResendEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      // As soon as RESEND_API_KEY is set, real delivery kicks in — in any environment. Refuses
      // to boot in production with no key configured, so nobody ships this believing OTPs are
      // actually being delivered (mirrors ConsoleSmsProvider's equivalent guard).
      inject: [ConfigService, ConsoleEmailProvider, ResendEmailProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        consoleProvider: ConsoleEmailProvider,
        resendProvider: ResendEmailProvider,
      ) => {
        if (config.get('RESEND_API_KEY', { infer: true }))
          return resendProvider;
        if (config.get('NODE_ENV', { infer: true }) === 'production') {
          throw new Error(
            'RESEND_API_KEY must be set in production — no OTP email provider configured.',
          );
        }
        return consoleProvider;
      },
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
