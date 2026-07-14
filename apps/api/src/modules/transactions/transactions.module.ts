import { Module } from '@nestjs/common';
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { TransactionsController } from './transactions.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [FileStorageModule],
  controllers: [TransactionsController, AdminTransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
