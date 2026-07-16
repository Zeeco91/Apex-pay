// Prisma's default interactive-transaction timeout (5s) is tight for any DB transaction with
// more than a handful of sequential steps against a remote Postgres instance — each step is its
// own network round trip. Hit in practice (P2028 "transaction not found" mid-disburse, once fee
// allocation pushed that transaction to ~19 sequential steps) before this existed. Pass as
// $transaction's second argument on any transaction that fans out into several related writes
// (matching, disbursement, fee/bonus allocation) rather than a couple of simple updates.
export const EXTENDED_TX_OPTIONS = { timeout: 15_000 };
