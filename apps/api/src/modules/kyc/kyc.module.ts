import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../common/audit-log/audit-log.module';
import { KycController } from './kyc.controller';
import { AdminKycController } from './admin-kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [AuditLogModule],
  controllers: [KycController, AdminKycController],
  providers: [KycService],
})
export class KycModule {}
