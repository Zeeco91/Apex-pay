import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { KycStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { KycService } from './kyc.service';
import { RejectKycDto } from './dto/reject-kyc.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminKycController {
  constructor(private readonly kycService: KycService) {}

  @Get('admin/kyc')
  async list(@Query('status') status?: KycStatus) {
    const data = await this.kycService.listForAdmin(status);
    return { success: true, data };
  }

  @Post('admin/kyc/:id/approve')
  async approve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.kycService.approve(admin.id, id);
    return { success: true, data };
  }

  @Post('admin/kyc/:id/reject')
  async reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectKycDto,
  ) {
    const data = await this.kycService.reject(admin.id, id, dto.reason);
    return { success: true, data };
  }
}
