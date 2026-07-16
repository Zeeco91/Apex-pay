import { Module } from '@nestjs/common';
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { AuditLogModule } from '../../common/audit-log/audit-log.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { TransactionsController } from './transactions.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [FileStorageModule, ReferralsModule, AuditLogModule],
  controllers: [TransactionsController, AdminTransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
