import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { UsersService, toPublicUser } from './users.service';
import { UpdatePayoutBankDetailsDto } from './dto/update-payout-bank-details.dto';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getMe(@CurrentUser() authUser: AuthenticatedUser) {
    const user = await this.usersService.findById(authUser.id);
    // Guarded by JwtAuthGuard, whose strategy already loads and validates the user —
    // a miss here would mean the account was deleted between token validation and this query.
    if (!user) {
      return { success: false, message: 'Account not found' };
    }
    return { success: true, data: toPublicUser(user) };
  }

  @Patch('payout-bank-details')
  async updatePayoutBankDetails(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: UpdatePayoutBankDetailsDto,
  ) {
    const user = await this.usersService.updatePayoutBankDetails(authUser.id, {
      bankName: dto.bankName,
      accountNumber: dto.accountNumber,
      accountName: dto.accountName,
    });
    return { success: true, data: toPublicUser(user) };
  }
}
