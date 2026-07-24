"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ArrowRightIcon, LevelsIcon, QueueIcon } from "@/components/dashboard/NavIcons";

const ACTION_CARDS = [
  {
    href: "/dashboard/levels",
    label: "Provide Help",
    description: "Join a level and get matched with someone to pay.",
    Icon: LevelsIcon,
  },
  {
    href: "/dashboard/queue",
    label: "Get Help",
    description: "Get matched with someone who will pay you.",
    Icon: QueueIcon,
  },
];

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {user.fullName}
        </h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s a snapshot of your account.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {ACTION_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-6 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <card.Icon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-lg font-semibold text-foreground">{card.label}</p>
                <p className="mt-0.5 text-sm text-muted">{card.description}</p>
              </div>
            </div>
            <ArrowRightIcon className="h-5 w-5 shrink-0 text-muted transition-colors group-hover:text-primary" />
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-background p-6 sm:max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your referral code</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <code className="text-lg font-bold tracking-wide text-foreground">{user.referralCode}</code>
          <button
            type="button"
            onClick={() => void copyReferralCode()}
            className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
