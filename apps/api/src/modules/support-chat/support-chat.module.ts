import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../common/audit-log/audit-log.module';
import { SupportChatController } from './support-chat.controller';
import { AdminSupportChatController } from './admin-support-chat.controller';
import { SupportChatService } from './support-chat.service';

@Module({
  imports: [AuditLogModule],
  controllers: [SupportChatController, AdminSupportChatController],
  providers: [SupportChatService],
})
export class SupportChatModule {}
