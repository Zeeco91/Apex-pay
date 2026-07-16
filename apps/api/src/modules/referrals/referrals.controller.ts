import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ReferralsService } from './referrals.service';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('referrals')
  async myReferrals(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.referralsService.listMyReferrals(user.id);
    return { success: true, data };
  }

  @Get('referral-bonuses')
  async myReferralBonuses(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.referralsService.listMyReferralBonuses(user.id);
    return { success: true, data };
  }

  @Post('referral-bonuses/withdrawals')
  async requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestWithdrawalDto,
  ) {
    const data = await this.referralsService.requestWithdrawal(
      user.id,
      dto.referralBonusId,
    );
    return { success: true, data };
  }

  @Get('referral-bonuses/withdrawals')
  async myWithdrawalRequests(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.referralsService.listMyWithdrawalRequests(user.id);
    return { success: true, data };
  }
}
