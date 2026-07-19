import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueueHealthService } from './queue-health.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminQueueHealthController {
  constructor(private readonly queueHealthService: QueueHealthService) {}

  @Get('admin/queue-health')
  async list() {
    const data = await this.queueHealthService.getHealthForAllLevels();
    return { success: true, data };
  }
}
