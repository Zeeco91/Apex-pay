import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { QueueService } from './queue.service';
import { ManualMatchDto } from './dto/manual-match.dto';
import { HoldEntryDto } from './dto/hold-entry.dto';
import { ReleaseEntryDto } from './dto/release-entry.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminQueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('admin/queues/:levelId')
  async listForLevel(@Param('levelId') levelId: string) {
    const data = await this.queueService.listForAdminByLevel(levelId);
    return { success: true, data };
  }

  @Post('admin/queues/:levelId/match')
  async manualMatch(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('levelId') levelId: string,
    @Body() dto: ManualMatchDto,
  ) {
    const data = await this.queueService.manualMatch(
      admin.id,
      levelId,
      dto.payerEntryId,
      dto.payeeEntryId,
      dto.reason,
    );
    return { success: true, data };
  }

  @Post('admin/queue-entries/:id/hold')
  async hold(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: HoldEntryDto,
  ) {
    const data = await this.queueService.holdEntry(admin.id, id, dto.reason);
    return { success: true, data };
  }

  @Post('admin/queue-entries/:id/release')
  async release(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReleaseEntryDto,
  ) {
    const data = await this.queueService.releaseEntry(admin.id, id, dto.reason);
    return { success: true, data };
  }
}
