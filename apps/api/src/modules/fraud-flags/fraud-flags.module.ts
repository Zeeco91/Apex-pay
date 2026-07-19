import { Module } from '@nestjs/common';
import { AdminFraudFlagsController } from './admin-fraud-flags.controller';
import { FraudFlagsService } from './fraud-flags.service';

@Module({
  controllers: [AdminFraudFlagsController],
  providers: [FraudFlagsService],
})
export class FraudFlagsModule {}
