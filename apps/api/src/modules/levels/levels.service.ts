import { Injectable } from '@nestjs/common';
import type { Level } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface PublicLevel {
  id: string;
  name: string;
  contributionAmount: number;
  feePercent: number;
  incentiveBonusRateOfPrincipal: number;
  sortOrder: number;
}

@Injectable()
export class LevelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<PublicLevel[]> {
    const levels = await this.prisma.level.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return levels.map(toPublicLevel);
  }
}

function toPublicLevel(level: Level): PublicLevel {
  return {
    id: level.id,
    name: level.name,
    contributionAmount: level.contributionAmount,
    feePercent: level.feePercent,
    incentiveBonusRateOfPrincipal: level.incentiveBonusRateOfPrincipal,
    sortOrder: level.sortOrder,
  };
}
