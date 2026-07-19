import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface LevelQueueHealth {
  levelId: string;
  levelName: string;
  isActive: boolean;
  waitingCount: number;
  oldestWaitingAgeDays: number | null;
  stalledCount: number;
  stalledThresholdDays: number;
  completedCount: number;
  avgCompletionDays: number | null;
}

@Injectable()
export class QueueHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealthForAllLevels(): Promise<LevelQueueHealth[]> {
    const levels = await this.prisma.level.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return Promise.all(levels.map((level) => this.getHealthForLevel(level)));
  }

  private async getHealthForLevel(level: {
    id: string;
    name: string;
    isActive: boolean;
    stalledThresholdDays: number;
  }): Promise<LevelQueueHealth> {
    const now = new Date();
    const stalledCutoff = new Date(
      now.getTime() - level.stalledThresholdDays * MS_PER_DAY,
    );

    const [waitingCount, waitingEntries, stalledCount, completedEntries] =
      await Promise.all([
        this.prisma.queueEntry.count({
          where: { levelId: level.id, status: 'WAITING_FOR_PAYOUT' },
        }),
        this.prisma.queueEntry.findMany({
          where: { levelId: level.id, status: 'WAITING_FOR_PAYOUT' },
          select: { joinedAt: true },
          orderBy: { joinedAt: 'asc' },
          take: 1,
        }),
        this.prisma.queueEntry.count({
          where: {
            levelId: level.id,
            status: 'WAITING_FOR_PAYOUT',
            joinedAt: { lte: stalledCutoff },
          },
        }),
        this.prisma.queueEntry.findMany({
          where: { levelId: level.id, status: 'COMPLETED' },
          select: { joinedAt: true, completedAt: true },
        }),
      ]);

    const oldestWaitingAgeDays = waitingEntries[0]
      ? Math.floor(
          (now.getTime() - waitingEntries[0].joinedAt.getTime()) / MS_PER_DAY,
        )
      : null;

    const completionDurations = completedEntries
      .filter((entry) => entry.completedAt !== null)
      .map(
        (entry) =>
          (entry.completedAt!.getTime() - entry.joinedAt.getTime()) /
          MS_PER_DAY,
      );
    const avgCompletionDays =
      completionDurations.length > 0
        ? Math.round(
            (completionDurations.reduce((sum, d) => sum + d, 0) /
              completionDurations.length) *
              10,
          ) / 10
        : null;

    return {
      levelId: level.id,
      levelName: level.name,
      isActive: level.isActive,
      waitingCount,
      oldestWaitingAgeDays,
      stalledCount,
      stalledThresholdDays: level.stalledThresholdDays,
      completedCount: completedEntries.length,
      avgCompletionDays,
    };
  }
}
