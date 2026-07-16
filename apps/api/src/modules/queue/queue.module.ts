import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../common/audit-log/audit-log.module';
import { QueueController } from './queue.controller';
import { AdminQueueController } from './admin-queue.controller';
import { QueueService } from './queue.service';

@Module({
  imports: [AuditLogModule],
  controllers: [QueueController, AdminQueueController],
  providers: [QueueService],
})
export class QueueModule {}
