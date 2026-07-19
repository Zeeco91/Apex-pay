"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { listUsers, suspendUser, banUser, reinstateUser } from "@/lib/api/admin/users";
import { formatEnumLabel } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ReasonActionButton } from "@/components/admin/ReasonActionButton";
import type { AdminUserSummary, KycStatus, UserStatus } from "@/types/api";

const STATUS_TONE: Record<UserStatus, BadgeTone> = {
  ACTIVE: "success",
  PENDING_KYC: "warning",
  SUSPENDED: "danger",
  BANNED: "danger",
};

const KYC_TONE: Record<KycStatus, BadgeTone> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  NOT_SUBMITTED: "neutral",
};

export default function AdminUsersPage() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await listUsers(accessToken, {
          status: statusFilter || undefined,
          search: debouncedSearch || undefined,
        });
        if (!cancelled) {
          setUsers(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load users.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, statusFilter, debouncedSearch]);

  async function handleSuspend(userId: string, reason: string) {
    if (!accessToken) return;
    const updated = await suspendUser(accessToken, userId, reason);
    setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
  }

  async function handleBan(userId: string, reason: string) {
    if (!accessToken) return;
    const updated = await banUser(accessToken, userId, reason);
    setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
  }

  async function handleReinstate(userId: string, reason: string) {
    if (!accessToken) return;
    const updated = await reinstateUser(accessToken, userId, reason || undefined);
    setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted">{users.length} member{users.length === 1 ? "" : "s"} matching your filters.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Search name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or phone"
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as UserStatus | "")}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_KYC">Pending KYC</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </select>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted">No users match your filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">KYC</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 text-foreground">{user.fullName}</td>
                  <td className="px-4 py-3 text-muted">{user.phone}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[user.status]}>{formatEnumLabel(user.status)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={KYC_TONE[user.kycStatus]}>{formatEnumLabel(user.kycStatus)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {(user.status === "ACTIVE" || user.status === "PENDING_KYC") && (
                        <ReasonActionButton
                          label="Suspend"
                          reasonLabel="Suspension reason"
                          confirmLabel="Suspend"
                          onConfirm={(reason) => handleSuspend(user.id, reason)}
                        />
                      )}
                      {user.status !== "BANNED" && (
                        <ReasonActionButton
                          label="Ban"
                          reasonLabel="Ban reason"
                          confirmLabel="Ban"
                          onConfirm={(reason) => handleBan(user.id, reason)}
                        />
                      )}
                      {(user.status === "SUSPENDED" || user.status === "BANNED") && (
                        <ReasonActionButton
                          label="Reinstate"
                          reasonRequired={false}
                          reasonLabel="Reinstatement note"
                          confirmLabel="Reinstate"
                          onConfirm={(reason) => handleReinstate(user.id, reason)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
