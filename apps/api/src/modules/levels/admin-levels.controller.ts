import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { LevelsService } from './levels.service';
import { UpdateLevelDto } from './dto/update-level.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminLevelsController {
  constructor(private readonly levelsService: LevelsService) {}

  @Get('admin/levels')
  async list() {
    const data = await this.levelsService.listForAdmin();
    return { success: true, data };
  }

  @Patch('admin/levels/:id')
  async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLevelDto,
  ) {
    const data = await this.levelsService.updateForAdmin(admin.id, id, dto);
    return { success: true, data };
  }
}
