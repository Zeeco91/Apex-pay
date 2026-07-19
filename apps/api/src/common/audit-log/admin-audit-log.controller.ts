import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AdminActionType } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('admin/audit-logs')
  async list(
    @Query('targetEntityType') targetEntityType?: string,
    @Query('adminUserId') adminUserId?: string,
    @Query('actionType') actionType?: AdminActionType,
    @Query('createdAtFrom') createdAtFrom?: string,
    @Query('createdAtTo') createdAtTo?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const data = await this.auditLogService.list({
      targetEntityType,
      adminUserId,
      actionType,
      createdAtFrom: createdAtFrom ? new Date(createdAtFrom) : undefined,
      createdAtTo: createdAtTo ? new Date(createdAtTo) : undefined,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
    return { success: true, data };
  }
}
