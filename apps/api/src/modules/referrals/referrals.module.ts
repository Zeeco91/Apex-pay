import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../common/audit-log/audit-log.module';
import { ReferralsController } from './referrals.controller';
import { AdminReferralsController } from './admin-referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ReferralsController, AdminReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
