import { Module } from '@nestjs/common';
import { AdminReconciliationController } from './admin-reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';

@Module({
  controllers: [AdminReconciliationController],
  providers: [ReconciliationService],
})
export class ReconciliationModule {}
