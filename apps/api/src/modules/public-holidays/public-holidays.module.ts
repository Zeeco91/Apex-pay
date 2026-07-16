import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../common/audit-log/audit-log.module';
import { AdminPublicHolidaysController } from './admin-public-holidays.controller';
import { PublicHolidaysService } from './public-holidays.service';

@Module({
  imports: [AuditLogModule],
  controllers: [AdminPublicHolidaysController],
  providers: [PublicHolidaysService],
})
export class PublicHolidaysModule {}
