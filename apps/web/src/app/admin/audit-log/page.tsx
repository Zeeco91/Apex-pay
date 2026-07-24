"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { listAuditLog } from "@/lib/api/admin/auditLog";
import { listUsers } from "@/lib/api/admin/users";
import { formatEnumLabel } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { AdminActionType, AdminAuditLogEntry, AdminUserSummary } from "@/types/api";

const ENTITY_TYPES = [
  "User",
  "QueueEntry",
  "Level",
  "Transaction",
  "WithdrawalRequest",
  "PublicHoliday",
];

const ACTION_TYPES: AdminActionType[] = [
  "USER_SUSPENDED",
  "USER_BANNED",
  "USER_REINSTATED",
  "QUEUE_ENTRY_HELD",
  "QUEUE_ENTRY_RELEASED",
  "QUEUE_MANUAL_MATCH",
  "LEVEL_UPDATED",
  "TRANSACTION_PRINCIPAL_CONFIRMED",
  "TRANSACTION_DISBURSED",
  "TRANSACTION_DISPUTE_RESOLVED",
  "WITHDRAWAL_APPROVED",
  "WITHDRAWAL_REJECTED",
  "WITHDRAWAL_PAID",
  "PUBLIC_HOLIDAY_ADDED",
  "PUBLIC_HOLIDAY_REMOVED",
];

const PAGE_SIZE = 50;

export default function AdminAuditLogPage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [admins, setAdmins] = useState<AdminUserSummary[]>([]);

  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState<AdminActionType | "">("");
  const [adminFilter, setAdminFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([listUsers(accessToken, { role: "ADMIN" }), listUsers(accessToken, { role: "SUPER_ADMIN" })])
      .then(([a, b]) => setAdmins([...a, ...b]))
      .catch(() => {
        // Non-critical — the admin filter dropdown just stays empty if this fails.
      });
  }, [accessToken]);

  function updateFilter<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setPage(0);
  }

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await listAuditLog(accessToken, {
          targetEntityType: entityTypeFilter || undefined,
          actionType: actionTypeFilter || undefined,
          adminUserId: adminFilter || undefined,
          createdAtFrom: fromDate ? new Date(fromDate).toISOString() : undefined,
          createdAtTo: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined,
          take: PAGE_SIZE,
          skip: page * PAGE_SIZE,
        });
        if (!cancelled) {
          setEntries(result.entries);
          setTotal(result.total);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load the audit log.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, entityTypeFilter, actionTypeFilter, adminFilter, fromDate, toDate, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit Log</h1>
        <p className="mt-1 text-sm text-muted">
          Every discretionary or adverse admin action, most recent first — {total} total.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Filter by entity type"
          value={entityTypeFilter}
          onChange={(e) => updateFilter(setEntityTypeFilter, e.target.value)}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by action type"
          value={actionTypeFilter}
          onChange={(e) => updateFilter(setActionTypeFilter, e.target.value as AdminActionType | "")}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
        >
          <option value="">All action types</option>
          {ACTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {formatEnumLabel(type)}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by admin"
          value={adminFilter}
          onChange={(e) => updateFilter(setAdminFilter, e.target.value)}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
        >
          <option value="">All admins</option>
          {admins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.fullName}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-muted">
          From
          <input
            type="date"
            value={fromDate}
            onChange={(e) => updateFilter(setFromDate, e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          To
          <input
            type="date"
            value={toDate}
            onChange={(e) => updateFilter(setToDate, e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted">Loading audit trail…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted">No matching audit log entries.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{formatEnumLabel(entry.actionType)}</Badge>
                    <span className="text-xs text-muted">
                      {entry.targetEntityType} · {entry.targetEntityId.slice(0, 8)}…
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-foreground">{entry.reason}</p>
                  <p className="mt-1 text-xs text-muted">
                    {entry.adminFullName} · {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
                {(entry.beforeState != null || entry.afterState != null) && (
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {expandedId === entry.id ? "Hide details" : "View details"}
                  </button>
                )}
              </div>
              {expandedId === entry.id && (
                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-muted">Before</p>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-surface p-3 text-foreground">
                      {JSON.stringify(entry.beforeState, null, 2) ?? "—"}
                    </pre>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-muted">After</p>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-surface p-3 text-foreground">
                      {JSON.stringify(entry.afterState, null, 2) ?? "—"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              className="px-4 py-2 text-xs"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              className="px-4 py-2 text-xs"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
