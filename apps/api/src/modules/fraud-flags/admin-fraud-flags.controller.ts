import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FraudFlagsService } from './fraud-flags.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminFraudFlagsController {
  constructor(private readonly fraudFlagsService: FraudFlagsService) {}

  @Get('admin/fraud-flags')
  async list() {
    const data = await this.fraudFlagsService.getFlags();
    return { success: true, data };
  }
}
