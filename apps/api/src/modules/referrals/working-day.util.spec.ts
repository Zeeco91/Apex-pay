import type { PrismaClient } from '@prisma/client';
import { addWorkingDays } from './working-day.util';

function fakeClient(holidayDates: string[] = []): PrismaClient {
  return {
    publicHoliday: {
      findMany: () =>
        Promise.resolve(
          holidayDates.map((date) => ({
            date: new Date(`${date}T00:00:00.000Z`),
          })),
        ),
    },
  } as unknown as PrismaClient;
}

describe('addWorkingDays', () => {
  it('skips weekends when counting working days', async () => {
    // Monday 2026-01-05 + 5 working days, no holidays in the window, should land on the
    // following Monday (2026-01-12) — Sat 2026-01-10 and Sun 2026-01-11 don't count.
    const start = new Date('2026-01-05T00:00:00.000Z');
    const result = await addWorkingDays(fakeClient(), start, 5);
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-12');
  });

  it('skips a public holiday that falls on an otherwise-counting weekday', async () => {
    // Monday 2026-01-05 + 1 working day would normally be Tuesday 2026-01-06 — but that date
    // is a holiday here, so it should skip to Wednesday 2026-01-07 instead.
    const start = new Date('2026-01-05T00:00:00.000Z');
    const result = await addWorkingDays(fakeClient(['2026-01-06']), start, 1);
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-07');
  });

  it('returns the start date unchanged when zero working days are requested', async () => {
    const start = new Date('2026-01-05T00:00:00.000Z');
    const result = await addWorkingDays(fakeClient(), start, 0);
    expect(result.getTime()).toBe(start.getTime());
  });
});
