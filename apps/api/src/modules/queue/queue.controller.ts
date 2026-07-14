import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { QueueService } from './queue.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('levels/:levelId/queue-entries')
  async joinQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('levelId') levelId: string,
  ) {
    const result = await this.queueService.joinQueue(user.id, levelId);
    return { success: true, data: result };
  }

  @Get('levels/:levelId/queue-stats')
  async queueStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('levelId') levelId: string,
  ) {
    const stats = await this.queueService.getQueueStats(user.id, levelId);
    return { success: true, data: stats };
  }

  @Get('users/me/queue-entries')
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    const entries = await this.queueService.listForUser(user.id);
    return { success: true, data: entries };
  }

  @Get('queue-entries/:id')
  async getEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const entry = await this.queueService.getById(user.id, id);
    return { success: true, data: entry };
  }

  @Post('queue-entries/:id/cancel')
  async cancelEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const entry = await this.queueService.cancelEntry(user.id, id);
    return { success: true, data: entry };
  }
}
