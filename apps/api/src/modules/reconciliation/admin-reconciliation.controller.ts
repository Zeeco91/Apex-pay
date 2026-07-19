import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReconciliationService } from './reconciliation.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get('admin/reconciliation-runs')
  async list(@Query('limit') limit?: string) {
    const data = await this.reconciliationService.list(
      limit ? Number(limit) : undefined,
    );
    return { success: true, data };
  }

  @Post('admin/reconciliation-runs/run')
  async runNow() {
    const data = await this.reconciliationService.run('MANUAL');
    return { success: true, data };
  }
}
