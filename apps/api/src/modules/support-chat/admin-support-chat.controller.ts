import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { CHAT_MESSAGE_THROTTLE_LIMIT } from '../../common/throttle.constants';
import { SupportChatService } from './support-chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ResolveConversationDto } from './dto/resolve-conversation.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminSupportChatController {
  constructor(private readonly supportChatService: SupportChatService) {}

  @Get('admin/support/conversations')
  async list(
    @Query('status') status?: 'OPEN' | 'RESOLVED',
    @Query('search') search?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const data = await this.supportChatService.listConversationsForAdmin({
      status,
      search,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
    return { success: true, data };
  }

  @Get('admin/support/conversations/:id/messages')
  async listMessages(@Param('id') id: string) {
    const data = await this.supportChatService.getMessagesForAdmin(id);
    return { success: true, data };
  }

  @Throttle({ default: { limit: CHAT_MESSAGE_THROTTLE_LIMIT, ttl: 60_000 } })
  @Post('admin/support/conversations/:id/messages')
  async sendMessage(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const data = await this.supportChatService.sendMessageAsAdmin(
      admin.id,
      id,
      dto.body,
    );
    return { success: true, data };
  }

  @Post('admin/support/conversations/:id/read')
  async markRead(@Param('id') id: string): Promise<{ success: true }> {
    await this.supportChatService.markReadAsAdmin(id);
    return { success: true };
  }

  @Post('admin/support/conversations/:id/resolve')
  async resolve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveConversationDto,
    @Ip() ip: string,
  ) {
    const data = await this.supportChatService.resolveConversation(
      admin.id,
      id,
      dto.reason,
      ip,
    );
    return { success: true, data };
  }
}
