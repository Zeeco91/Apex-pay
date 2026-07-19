import { Module } from '@nestjs/common';
import { AdminQueueHealthController } from './admin-queue-health.controller';
import { QueueHealthService } from './queue-health.service';

@Module({
  controllers: [AdminQueueHealthController],
  providers: [QueueHealthService],
})
export class QueueHealthModule {}
