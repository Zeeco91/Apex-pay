import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { UserRole, UserStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { ReinstateUserDto } from './dto/reinstate-user.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('admin/users')
  async list(
    @Query('status') status?: UserStatus,
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
  ) {
    const data = await this.usersService.listForAdmin({
      status,
      role,
      search,
    });
    return { success: true, data };
  }

  @Get('admin/users/:id')
  async getOne(@Param('id') id: string) {
    const data = await this.usersService.getForAdmin(id);
    return { success: true, data };
  }

  @Post('admin/users/:id/suspend')
  async suspend(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
  ) {
    const data = await this.usersService.suspendUser(admin.id, id, dto.reason);
    return { success: true, data };
  }

  @Post('admin/users/:id/ban')
  async ban(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: BanUserDto,
  ) {
    const data = await this.usersService.banUser(admin.id, id, dto.reason);
    return { success: true, data };
  }

  @Post('admin/users/:id/reinstate')
  async reinstate(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReinstateUserDto,
  ) {
    const data = await this.usersService.reinstateUser(
      admin.id,
      id,
      dto.reason,
    );
    return { success: true, data };
  }
}
