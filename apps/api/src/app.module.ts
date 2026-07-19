import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DEFAULT_THROTTLE_LIMIT } from './common/throttle.constants';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { SmsModule } from './common/sms/sms.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { KycModule } from './modules/kyc/kyc.module';
import { LevelsModule } from './modules/levels/levels.module';
import { QueueModule } from './modules/queue/queue.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { AuditLogModule } from './common/audit-log/audit-log.module';
import { PublicHolidaysModule } from './modules/public-holidays/public-holidays.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { QueueHealthModule } from './modules/queue-health/queue-health.module';
import { FraudFlagsModule } from './modules/fraud-flags/fraud-flags.module';
import { SupportChatModule } from './modules/support-chat/support-chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: DEFAULT_THROTTLE_LIMIT },
    ]),
    PrismaModule,
    CryptoModule,
    SmsModule,
    HealthModule,
    UsersModule,
    AuthModule,
    KycModule,
    LevelsModule,
    QueueModule,
    TransactionsModule,
    ReferralsModule,
    AuditLogModule,
    PublicHolidaysModule,
    ReconciliationModule,
    QueueHealthModule,
    FraudFlagsModule,
    SupportChatModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
