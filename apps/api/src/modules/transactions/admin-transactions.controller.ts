import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { TransactionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { TransactionsService } from './transactions.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

/**
 * No admin UI exists yet (that's the Admin Panel Core phase, plan §9 step 8) — these endpoints
 * are role-gated and exercised directly for now. MFA enforcement for admin actions is deferred
 * to the Hardening & Compliance phase (plan §9 step 10), as documented in the plan's risk list.
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminTransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('admin/transactions')
  async list(@Query('status') status?: TransactionStatus) {
    const data = await this.transactionsService.listForAdmin(status);
    return { success: true, data };
  }

  @Post('admin/transactions/:id/resolve-dispute')
  async resolveDispute(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    const data = await this.transactionsService.resolveDispute(
      admin.id,
      id,
      dto,
    );
    return { success: true, data };
  }

  @Get('admin/treasury-ledger')
  async treasuryLedger() {
    const data = await this.transactionsService.getTreasuryLedger();
    return { success: true, data };
  }
}
