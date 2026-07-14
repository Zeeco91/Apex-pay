import { Global, Module } from '@nestjs/common';
import { ConsoleSmsProvider } from './console-sms.provider';
import { SMS_PROVIDER } from './sms-provider.interface';

@Global()
@Module({
  providers: [{ provide: SMS_PROVIDER, useClass: ConsoleSmsProvider }],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
