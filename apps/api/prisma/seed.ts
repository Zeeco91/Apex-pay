// Seeds the 6 contribution levels. Idempotent (upsert by sortOrder) so it's safe to
// re-run in dev/staging. Real admin-driven level management arrives in the Admin Panel
// Core phase (plan §9 step 8) — until then this script is the source of truth.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LevelSeed {
  sortOrder: number;
  name: string;
  contributionAmount: number;
  incentivePoolAllocationPercentOfFee: number;
  incentiveBonusRateOfPrincipal: number;
  stalledThresholdDays: number;
}

// referralPoolAllocationPercentOfFee is a flat 40% of the fee across every level (plan §5).
// incentivePoolAllocationPercentOfFee rises with level so higher tiers draw a larger share
// of the incentive pool (plan §3); platformRevenuePercentOfFee absorbs the remainder so the
// three always sum to 100.
const REFERRAL_POOL_PERCENT_OF_FEE = 40;

const LEVEL_SEEDS: LevelSeed[] = [
  { sortOrder: 1, name: 'Bronze', contributionAmount: 5_000, incentivePoolAllocationPercentOfFee: 10, incentiveBonusRateOfPrincipal: 0, stalledThresholdDays: 14 },
  { sortOrder: 2, name: 'Silver', contributionAmount: 10_000, incentivePoolAllocationPercentOfFee: 14, incentiveBonusRateOfPrincipal: 0.5, stalledThresholdDays: 14 },
  { sortOrder: 3, name: 'Gold', contributionAmount: 20_000, incentivePoolAllocationPercentOfFee: 18, incentiveBonusRateOfPrincipal: 1, stalledThresholdDays: 21 },
  { sortOrder: 4, name: 'Platinum', contributionAmount: 50_000, incentivePoolAllocationPercentOfFee: 22, incentiveBonusRateOfPrincipal: 1.5, stalledThresholdDays: 21 },
  { sortOrder: 5, name: 'Diamond', contributionAmount: 100_000, incentivePoolAllocationPercentOfFee: 26, incentiveBonusRateOfPrincipal: 2, stalledThresholdDays: 30 },
  { sortOrder: 6, name: 'Diamond Elite', contributionAmount: 200_000, incentivePoolAllocationPercentOfFee: 30, incentiveBonusRateOfPrincipal: 3, stalledThresholdDays: 30 },
];

async function main() {
  for (const seed of LEVEL_SEEDS) {
    const platformRevenuePercentOfFee =
      100 - REFERRAL_POOL_PERCENT_OF_FEE - seed.incentivePoolAllocationPercentOfFee;

    await prisma.level.upsert({
      where: { sortOrder: seed.sortOrder },
      update: {
        name: seed.name,
        contributionAmount: seed.contributionAmount,
        referralPoolAllocationPercentOfFee: REFERRAL_POOL_PERCENT_OF_FEE,
        incentivePoolAllocationPercentOfFee: seed.incentivePoolAllocationPercentOfFee,
        platformRevenuePercentOfFee,
        incentiveBonusRateOfPrincipal: seed.incentiveBonusRateOfPrincipal,
        stalledThresholdDays: seed.stalledThresholdDays,
      },
      create: {
        sortOrder: seed.sortOrder,
        name: seed.name,
        contributionAmount: seed.contributionAmount,
        feePercent: 5,
        referralPoolAllocationPercentOfFee: REFERRAL_POOL_PERCENT_OF_FEE,
        incentivePoolAllocationPercentOfFee: seed.incentivePoolAllocationPercentOfFee,
        platformRevenuePercentOfFee,
        incentiveBonusRateOfPrincipal: seed.incentiveBonusRateOfPrincipal,
        stalledThresholdDays: seed.stalledThresholdDays,
      },
    });
  }

  console.log(`Seeded ${LEVEL_SEEDS.length} levels.`);

  // Singleton running-balance counter for the treasury ledger (phase 6) — must exist before
  // any TreasuryLedgerEntry write, since those increment it atomically rather than creating it.
  await prisma.treasuryBalance.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, balance: 0 },
  });
  console.log('Seeded treasury balance singleton.');

  // The two fee pools (phase 7) — must exist before any disbursement, since fee allocation
  // increments these rather than creating them.
  for (const poolType of ['REFERRAL', 'LEVEL_INCENTIVE'] as const) {
    await prisma.feePool.upsert({
      where: { poolType },
      update: {},
      create: { poolType },
    });
  }
  console.log('Seeded fee pools.');

  // Starter public holiday calendar for the referral bonus's 30-*working*-day hold calculation
  // (plan §5). Fixed-date holidays are accurate; Islamic calendar dates (Eid al-Fitr/al-Adha)
  // are estimates — a real admin-editable calendar arrives with the Admin Panel Core phase.
  const PUBLIC_HOLIDAYS_2026 = [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-03-20', name: 'Eid al-Fitr' },
    { date: '2026-03-21', name: 'Eid al-Fitr Holiday' },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-04-06', name: 'Easter Monday' },
    { date: '2026-05-01', name: "Workers' Day" },
    { date: '2026-05-27', name: 'Eid al-Adha' },
    { date: '2026-05-28', name: 'Eid al-Adha Holiday' },
    { date: '2026-06-12', name: 'Democracy Day' },
    { date: '2026-10-01', name: 'Independence Day' },
    { date: '2026-12-25', name: 'Christmas Day' },
    { date: '2026-12-28', name: 'Boxing Day (Observed)' },
  ];
  for (const holiday of PUBLIC_HOLIDAYS_2026) {
    await prisma.publicHoliday.upsert({
      where: { date: new Date(holiday.date) },
      update: { name: holiday.name },
      create: { date: new Date(holiday.date), name: holiday.name },
    });
  }
  console.log(`Seeded ${PUBLIC_HOLIDAYS_2026.length} public holidays.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
