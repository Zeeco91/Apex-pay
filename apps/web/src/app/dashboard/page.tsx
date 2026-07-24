"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { listMyQueueEntries } from "@/lib/api/queue";
import { getMyReferralBonuses } from "@/lib/api/referrals";
import { formatNaira } from "@/lib/constants";
import { describeQueueEntryStatus } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  ArrowRightIcon,
  BanknoteIcon,
  GiftIcon,
  QueueIcon,
} from "@/components/dashboard/NavIcons";
import type { QueueEntryStatus, QueueEntrySummary, ReferralBonusSummary } from "@/types/api";

const QUEUE_STATUS_TONE: Record<QueueEntryStatus, BadgeTone> = {
  PENDING_JOIN_PAYMENT: "warning",
  WAITING_FOR_PAYOUT: "info",
  MATCHED_AS_PAYEE: "success",
  COMPLETED: "success",
  CANCELLED: "neutral",
  ADMIN_HOLD: "danger",
};

const ACTIVE_STATUSES: QueueEntryStatus[] = [
  "PENDING_JOIN_PAYMENT",
  "WAITING_FOR_PAYOUT",
  "MATCHED_AS_PAYEE",
];

const QUICK_LINKS = [
  { href: "/dashboard/levels", label: "Browse savings levels" },
  { href: "/dashboard/queue", label: "View my queue" },
  { href: "/dashboard/referrals", label: "Referrals & bonuses" },
  { href: "/dashboard/payout-details", label: "Payout details" },
];

export default function DashboardOverviewPage() {
  const { user, accessToken } = useAuth();
  const [entries, setEntries] = useState<QueueEntrySummary[] | null>(null);
  const [bonuses, setBonuses] = useState<ReferralBonusSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const [entriesResult, bonusesResult] = await Promise.all([
          listMyQueueEntries(accessToken),
          getMyReferralBonuses(accessToken),
        ]);
        if (!cancelled) {
          setEntries(entriesResult);
          setBonuses(bonusesResult);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Couldn't load your dashboard data.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!user) return null;

  async function copyReferralCode() {
    try {
      await navigator.clipboard.writeText(user!.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — the code is still
      // visible on screen, so failing silently here doesn't block the user.
    }
  }

  const isLoading = entries === null || bonuses === null;
  const activeEntryCount = entries?.filter((e) => ACTIVE_STATUSES.includes(e.status)).length ?? 0;
  const totalContributed =
    entries?.filter((e) => e.status !== "CANCELLED").reduce((sum, e) => sum + e.contributionAmount, 0) ?? 0;
  const totalBonuses = bonuses?.reduce((sum, b) => sum + b.bonusAmount, 0) ?? 0;
  const recentEntries = entries
    ? [...entries].sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()).slice(0, 5)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {user.fullName}
        </h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s a snapshot of your account.</p>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active queue entries"
          value={isLoading ? "—" : activeEntryCount}
          hint="Levels you're currently in"
          icon={<QueueIcon />}
        />
        <StatCard
          label="Total contributed"
          value={isLoading ? "—" : formatNaira(totalContributed)}
          hint="Across all non-cancelled entries"
          icon={<BanknoteIcon />}
        />
        <StatCard
          label="Referral bonuses earned"
          value={isLoading ? "—" : formatNaira(totalBonuses)}
          hint={isLoading ? undefined : `${bonuses?.length ?? 0} bonus${bonuses?.length === 1 ? "" : "es"}`}
          icon={<GiftIcon />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">Recent queue activity</h2>
          {isLoading ? (
            <div className="mt-4 flex flex-col gap-3" aria-busy="true" aria-label="Loading recent activity">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          ) : recentEntries.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              You haven&apos;t joined a level yet.{" "}
              <Link href="/dashboard/levels" className="font-medium text-primary underline underline-offset-4">
                Browse levels
              </Link>{" "}
              to get started.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{entry.levelName}</p>
                    <p className="text-xs text-muted">
                      {formatNaira(entry.contributionAmount)} · {new Date(entry.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge tone={QUEUE_STATUS_TONE[entry.status]}>{describeQueueEntryStatus(entry.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-background p-6">
          <h2 className="text-lg font-semibold text-foreground">Quick actions</h2>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your referral code</p>
                <code className="text-sm font-bold tracking-wide text-foreground">{user.referralCode}</code>
              </div>
              <button
                type="button"
                onClick={() => void copyReferralCode()}
                className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                {link.label}
                <ArrowRightIcon />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
