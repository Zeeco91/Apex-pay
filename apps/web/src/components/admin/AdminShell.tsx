"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { SITE_NAME } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/queues", label: "Queues" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/treasury", label: "Treasury" },
  { href: "/admin/referrals", label: "Referrals" },
  { href: "/admin/levels", label: "Levels" },
  { href: "/admin/queue-health", label: "Queue Health" },
  { href: "/admin/fraud-flags", label: "Fraud Flags" },
  { href: "/admin/reconciliation", label: "Reconciliation" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/audit-log", label: "Audit Log" },
  { href: "/admin/mfa-setup", label: "Security" },
];

/**
 * Every admin route lives under this shell. Role enforcement here is a UX convenience only —
 * the real boundary is server-side RolesGuard on every /admin/* API route; this just keeps a
 * non-admin from seeing an admin-shaped page full of 403s.
 */
const MFA_SETUP_PATH = "/admin/mfa-setup";

export function AdminShell({ children }: { children: ReactNode }) {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMfaSetupRoute = pathname === MFA_SETUP_PATH;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && user) {
      if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        router.replace("/dashboard");
      } else if (!user.mfaEnabled && !isMfaSetupRoute) {
        // Admin trust model hardening (plan §10) — MFA is mandatory before touching any admin
        // feature, enforced again server-side by RolesGuard on every /admin/* API route.
        router.replace(MFA_SETUP_PATH);
      }
    }
  }, [status, user, router, isMfaSetupRoute]);

  const isAuthorizedAdmin =
    status === "authenticated" &&
    user &&
    (user.role === "ADMIN" || user.role === "SUPER_ADMIN") &&
    (user.mfaEnabled || isMfaSetupRoute);

  if (!isAuthorizedAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface" role="status" aria-live="polite">
        <span className="text-sm text-muted">Loading admin console…</span>
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <Link href="/admin" className="text-lg font-bold tracking-tight text-foreground">
            {SITE_NAME.split(" ")[0]}
            <span className="text-primary"> {SITE_NAME.split(" ")[1]}</span>
            <span className="ml-2 text-sm font-medium text-muted">Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{user.fullName}</span>
            <Badge tone="info">{user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</Badge>
            <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-foreground">
              Member view
            </Link>
            <Button variant="outline" className="px-4 py-2 text-xs" onClick={() => void handleLogout()}>
              Log Out
            </Button>
          </div>
        </div>
        <nav aria-label="Admin" className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 pb-3 sm:px-8">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
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
      <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8">{children}</main>
    </div>
  );
}
