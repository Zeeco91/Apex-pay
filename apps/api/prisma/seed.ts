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
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
