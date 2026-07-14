"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatEnumLabel } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

const KYC_TONE: Record<string, BadgeTone> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  NOT_SUBMITTED: "neutral",
};

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
          Welcome back, {user.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s a snapshot of your account.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            Identity verification
          </p>
          <div className="mt-3">
            <Badge tone={KYC_TONE[user.kycStatus] ?? "neutral"}>{formatEnumLabel(user.kycStatus)}</Badge>
          </div>
          <p className="mt-3 text-sm text-muted">
            {user.kycStatus === "APPROVED"
              ? "Your identity has been verified."
              : "Identity verification isn't required to explore levels yet, but will be required before you can join a queue."}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            Your referral code
          </p>
          <div className="mt-3 flex items-center gap-3">
            <code className="rounded-lg bg-surface px-3 py-2 text-lg font-bold tracking-wide text-foreground">
              {user.referralCode}
            </code>
            <button
              type="button"
              onClick={() => void copyReferralCode()}
              className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">
            Share this code. Your bonus is credited once a referral&apos;s first contribution cycle is
            confirmed complete — never at sign-up.
          </p>
        </div>
      </div>
    </div>
  );
}
