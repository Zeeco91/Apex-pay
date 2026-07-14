import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { KycService } from './kyc.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import type { KycRecord } from '@prisma/client';

@Controller('users/me/kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post()
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitKycDto,
  ) {
    const record = await this.kycService.submit(user.id, dto);
    return { success: true, data: toPublicKyc(record) };
  }

  @Get()
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    const record = await this.kycService.getLatestForUser(user.id);
    return { success: true, data: record ? toPublicKyc(record) : null };
  }
}

// Never expose idNumberEncrypted (ciphertext of a national ID number) over the API.
function toPublicKyc(record: KycRecord) {
  return {
    id: record.id,
    idType: record.idType,
    status: record.status,
    rejectionReason: record.rejectionReason,
    createdAt: record.createdAt,
  };
}
