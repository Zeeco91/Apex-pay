"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { SITE_NAME } from "@/lib/constants";
import { formatEnumLabel } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  LevelsIcon,
  LogOutIcon,
  OverviewIcon,
  PayoutIcon,
  QueueIcon,
  ReferralsIcon,
} from "./NavIcons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", Icon: OverviewIcon },
  { href: "/dashboard/levels", label: "Levels", Icon: LevelsIcon },
  { href: "/dashboard/queue", label: "My Queue", Icon: QueueIcon },
  { href: "/dashboard/referrals", label: "Referrals", Icon: ReferralsIcon },
  { href: "/dashboard/payout-details", label: "Payout Details", Icon: PayoutIcon },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
  BANNED: "danger",
};

export function DashboardShell({ children }: { children: ReactNode }) {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated" || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface" role="status" aria-live="polite">
        <span className="text-sm text-muted">Loading your dashboard…</span>
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const logoMark = (
    <Link href="/dashboard" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-foreground">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
        A
      </span>
      {SITE_NAME.split(" ")[0]}
      <span className="text-primary">{SITE_NAME.split(" ")[1]}</span>
    </Link>
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 border-r border-border bg-background md:flex md:w-64 md:flex-col">
        <div className="px-6 py-6">{logoMark}</div>
        <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 px-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <item.Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-4 py-4">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <LogOutIcon className="h-5 w-5" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Mobile header (sidebar replacement below md) */}
      <header className="border-b border-border bg-background md:hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          {logoMark}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="text-sm font-medium text-muted hover:text-foreground"
          >
            Log Out
          </button>
        </div>
        <nav aria-label="Dashboard" className="flex gap-2 overflow-x-auto px-6 pb-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-end gap-3 border-b border-border bg-background px-8 py-4 md:flex">
          <span className="text-sm text-muted">{user.fullName}</span>
          <Badge tone={STATUS_TONE[user.status] ?? "neutral"}>{formatEnumLabel(user.status)}</Badge>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
