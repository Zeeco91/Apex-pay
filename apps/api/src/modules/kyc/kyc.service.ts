import { ConflictException, Injectable } from '@nestjs/common';
import type { KycRecord } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async submit(
    userId: string,
    params: { idType: string; idNumber: string },
  ): Promise<KycRecord> {
    const pending = await this.prisma.kycRecord.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException('A KYC submission is already pending review');
    }

    const idNumberEncrypted = this.crypto.encrypt(params.idNumber);
    const record = await this.prisma.kycRecord.create({
      data: {
        userId,
        idType: params.idType,
        idNumberEncrypted,
        status: 'PENDING',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus: 'PENDING' },
    });

    return record;
  }

  async getLatestForUser(userId: string): Promise<KycRecord | null> {
    return this.prisma.kycRecord.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
