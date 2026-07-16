import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../common/audit-log/audit-log.module';
import { LevelsController } from './levels.controller';
import { AdminLevelsController } from './admin-levels.controller';
import { LevelsService } from './levels.service';

@Module({
  imports: [AuditLogModule],
  controllers: [LevelsController, AdminLevelsController],
  providers: [LevelsService],
})
export class LevelsModule {}
