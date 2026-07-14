import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { TransactionsService } from './transactions.service';
import { RaiseDisputeDto } from './dto/raise-dispute.dto';

const MAX_PROOF_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const detail = await this.transactionsService.getForUser(user.id, id);
    return { success: true, data: detail };
  }

  @Post(':id/proof')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PROOF_UPLOAD_BYTES } }),
  )
  async uploadProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const detail = await this.transactionsService.uploadProof(
      user.id,
      id,
      file,
    );
    return { success: true, data: detail };
  }

  @Get(':id/proof-url')
  async getProofUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const url = await this.transactionsService.getProofUrl(user.id, id);
    return { success: true, data: { url } };
  }

  @Post(':id/confirm')
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const detail = await this.transactionsService.confirmReceipt(user.id, id);
    return { success: true, data: detail };
  }

  @Post(':id/dispute')
  async dispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RaiseDisputeDto,
  ) {
    const detail = await this.transactionsService.raiseDispute(
      user.id,
      id,
      dto.reason,
    );
    return { success: true, data: detail };
  }
}
