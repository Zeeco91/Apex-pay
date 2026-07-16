import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  ReferralBonusStatus,
  WithdrawalRequestStatus,
} from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ReferralsService } from './referrals.service';
import { RejectWithdrawalDto } from './dto/reject-withdrawal.dto';
import { MarkWithdrawalPaidDto } from './dto/mark-withdrawal-paid.dto';

/** No admin UI yet (Admin Panel Core phase, plan §9 step 8) — exercised directly for now. */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('admin/fee-pools')
  async feePools() {
    const data = await this.referralsService.listFeePools();
    return { success: true, data };
  }

  @Get('admin/referral-bonuses')
  async referralBonuses(@Query('status') status?: ReferralBonusStatus) {
    const data =
      await this.referralsService.listReferralBonusesForAdmin(status);
    return { success: true, data };
  }

  @Get('admin/level-incentive-bonuses')
  async levelIncentiveBonuses() {
    const data =
      await this.referralsService.listLevelIncentiveBonusesForAdmin();
    return { success: true, data };
  }

  @Get('admin/withdrawal-requests')
  async withdrawalRequests(@Query('status') status?: WithdrawalRequestStatus) {
    const data =
      await this.referralsService.listWithdrawalRequestsForAdmin(status);
    return { success: true, data };
  }

  @Post('admin/withdrawal-requests/:id/approve')
  async approve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.referralsService.approveWithdrawal(admin.id, id);
    return { success: true, data };
  }

  @Post('admin/withdrawal-requests/:id/reject')
  async reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    const data = await this.referralsService.rejectWithdrawal(
      admin.id,
      id,
      dto.reason,
    );
    return { success: true, data };
  }

  @Post('admin/withdrawal-requests/:id/mark-paid')
  async markPaid(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MarkWithdrawalPaidDto,
  ) {
    const data = await this.referralsService.markWithdrawalPaid(
      admin.id,
      id,
      dto.reference,
    );
    return { success: true, data };
  }
}
