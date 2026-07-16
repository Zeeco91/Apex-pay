import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { PublicHolidaysService } from './public-holidays.service';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';

/** Backs the referral bonus's 30-working-day hold calculator (see working-day.util.ts). */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminPublicHolidaysController {
  constructor(private readonly publicHolidaysService: PublicHolidaysService) {}

  @Get('admin/public-holidays')
  async list() {
    const data = await this.publicHolidaysService.list();
    return { success: true, data };
  }

  @Post('admin/public-holidays')
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreatePublicHolidayDto,
  ) {
    const data = await this.publicHolidaysService.create(admin.id, dto);
    return { success: true, data };
  }

  @Delete('admin/public-holidays/:id')
  @HttpCode(200)
  async remove(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.publicHolidaysService.remove(admin.id, id);
    return { success: true, data: null };
  }
}
