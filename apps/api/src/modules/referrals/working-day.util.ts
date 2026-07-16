import type { Prisma, PrismaClient } from '@prisma/client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Adds N *working* days (skipping Sat/Sun and rows in PublicHoliday) to startDate.
 * Used for the referral bonus's 30-working-day hold period (plan §5).
 */
export async function addWorkingDays(
  client: PrismaClient | Prisma.TransactionClient,
  startDate: Date,
  workingDays: number,
): Promise<Date> {
  // A generous calendar-day window that comfortably covers `workingDays` working days even
  // through a holiday-heavy stretch (worst case: every day is a holiday except Mon-Fri).
  const windowEnd = new Date(
    startDate.getTime() + workingDays * 3 * MS_PER_DAY,
  );
  const holidays = await client.publicHoliday.findMany({
    where: { date: { gte: startDate, lte: windowEnd } },
    select: { date: true },
  });
  const holidaySet = new Set(holidays.map((h) => toIsoDate(h.date)));

  let date = new Date(startDate);
  let remaining = workingDays;
  while (remaining > 0) {
    date = new Date(date.getTime() + MS_PER_DAY);
    const dayOfWeek = date.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (!isWeekend && !holidaySet.has(toIsoDate(date))) {
      remaining--;
    }
  }
  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
