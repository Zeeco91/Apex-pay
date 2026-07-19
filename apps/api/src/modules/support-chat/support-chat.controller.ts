import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { CHAT_MESSAGE_THROTTLE_LIMIT } from '../../common/throttle.constants';
import { SupportChatService } from './support-chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class SupportChatController {
  constructor(private readonly supportChatService: SupportChatService) {}

  @Get('conversation')
  async getConversation(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.supportChatService.getConversationForUser(user.id);
    return { success: true, data };
  }

  @Get('conversation/messages')
  async listMessages(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.supportChatService.listMessagesForUser(user.id);
    return { success: true, data };
  }

  @Throttle({ default: { limit: CHAT_MESSAGE_THROTTLE_LIMIT, ttl: 60_000 } })
  @Post('conversation/messages')
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ) {
    const data = await this.supportChatService.sendMessageAsUser(
      user.id,
      dto.body,
    );
    return { success: true, data };
  }

  @Post('conversation/read')
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.supportChatService.markReadAsUser(user.id);
    return { success: true };
  }
}
