"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { SITE_NAME } from "@/lib/constants";
import { formatEnumLabel } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/levels", label: "Levels" },
  { href: "/dashboard/queue", label: "My Queue" },
  { href: "/dashboard/payout-details", label: "Payout Details" },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "success",
  PENDING_KYC: "warning",
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

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-foreground">
            {SITE_NAME.split(" ")[0]}
            <span className="text-primary"> {SITE_NAME.split(" ")[1]}</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{user.fullName}</span>
            <Badge tone={STATUS_TONE[user.status] ?? "neutral"}>{formatEnumLabel(user.status)}</Badge>
            <Button variant="outline" className="px-4 py-2 text-xs" onClick={() => void handleLogout()}>
              Log Out
            </Button>
          </div>
        </div>
        <nav aria-label="Dashboard" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-6 pb-3 sm:px-8">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10 sm:px-8">{children}</main>
    </div>
  );
}
