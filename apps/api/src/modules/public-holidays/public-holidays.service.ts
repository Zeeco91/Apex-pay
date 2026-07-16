import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicHoliday } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';

const UNIQUE_CONSTRAINT_VIOLATION_CODE = 'P2002';

@Injectable()
export class PublicHolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(): Promise<PublicHoliday[]> {
    return this.prisma.publicHoliday.findMany({ orderBy: { date: 'asc' } });
  }

  async create(
    adminId: string,
    params: { date: string; name: string },
  ): Promise<PublicHoliday> {
    try {
      const holiday = await this.prisma.publicHoliday.create({
        data: { date: new Date(params.date), name: params.name },
      });
      await this.auditLog.record({
        adminUserId: adminId,
        actionType: 'PUBLIC_HOLIDAY_ADDED',
        targetEntityType: 'PublicHoliday',
        targetEntityId: holiday.id,
        reason: `Added "${holiday.name}" on ${params.date} to the working-day calendar`,
        afterState: { date: params.date, name: holiday.name },
      });
      return holiday;
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === UNIQUE_CONSTRAINT_VIOLATION_CODE
      ) {
        throw new ConflictException(
          'A public holiday is already recorded for this date.',
        );
      }
      throw error;
    }
  }

  async remove(adminId: string, id: string): Promise<void> {
    const holiday = await this.prisma.publicHoliday.findUnique({
      where: { id },
    });
    if (!holiday) throw new NotFoundException('Public holiday not found');

    await this.prisma.publicHoliday.delete({ where: { id } });
    await this.auditLog.record({
      adminUserId: adminId,
      actionType: 'PUBLIC_HOLIDAY_REMOVED',
      targetEntityType: 'PublicHoliday',
      targetEntityId: id,
      reason: `Removed "${holiday.name}" from the working-day calendar`,
      beforeState: {
        date: holiday.date.toISOString().slice(0, 10),
        name: holiday.name,
      },
    });
  }
}
