import Link from "next/link";

const SECTIONS = [
  {
    href: "/admin/users",
    title: "Users",
    description: "Search members, review status, suspend, ban, or reinstate accounts.",
  },
  {
    href: "/admin/kyc",
    title: "KYC Review",
    description: "Approve or reject pending identity verification submissions.",
  },
  {
    href: "/admin/queues",
    title: "Queues",
    description: "Inspect a level's live queue, manually match entries, or place holds.",
  },
  {
    href: "/admin/transactions",
    title: "Transactions",
    description: "Confirm received contributions, disburse payouts, resolve disputes.",
  },
  {
    href: "/admin/treasury",
    title: "Treasury",
    description: "Read-only ledger of every pot-balance-affecting movement.",
  },
  {
    href: "/admin/referrals",
    title: "Referrals & Bonuses",
    description: "Fee pool balances, referral/incentive bonuses, withdrawal requests.",
  },
  {
    href: "/admin/levels",
    title: "Levels",
    description: "Edit contribution amounts, fee splits, and incentive rates per level.",
  },
  {
    href: "/admin/audit-log",
    title: "Audit Log",
    description: "Raw trail of every adverse or discretionary admin action.",
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Console</h1>
        <p className="mt-1 text-sm text-muted">
          Every action here is logged with your identity, a reason, and a before/after snapshot.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-2xl border border-border bg-background p-6 transition-colors hover:border-primary"
          >
            <p className="text-base font-semibold text-foreground">{section.title}</p>
            <p className="mt-2 text-sm text-muted">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
