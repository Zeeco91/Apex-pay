import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AdminAuditLogController } from './admin-audit-log.controller';

@Module({
  controllers: [AdminAuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
