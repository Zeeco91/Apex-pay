import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';

/** Full browsing UI arrives with the Admin Reporting phase (plan §9 step 9) — this list
 * endpoint exists now for verification and for admins who just need the raw trail. */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('admin/audit-logs')
  async list(
    @Query('targetEntityType') targetEntityType?: string,
    @Query('adminUserId') adminUserId?: string,
  ) {
    const data = await this.auditLogService.list({
      targetEntityType,
      adminUserId,
    });
    return { success: true, data };
  }
}
