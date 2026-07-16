"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { listAuditLog } from "@/lib/api/admin/auditLog";
import { formatEnumLabel } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import type { AdminAuditLogEntry } from "@/types/api";

const ENTITY_TYPES = [
  "User",
  "KycRecord",
  "QueueEntry",
  "Level",
  "Transaction",
  "WithdrawalRequest",
  "PublicHoliday",
];

export default function AdminAuditLogPage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await listAuditLog(accessToken, {
          targetEntityType: entityTypeFilter || undefined,
        });
        if (!cancelled) {
          setEntries(data);
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
  }, [accessToken, entityTypeFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit Log</h1>
        <p className="mt-1 text-sm text-muted">
          Every discretionary or adverse admin action, most recent first. A full searchable viewer with richer
          filtering arrives in a later phase — this is the raw trail.
        </p>
      </div>

      <select
        value={entityTypeFilter}
        onChange={(e) => setEntityTypeFilter(e.target.value)}
        className="w-fit rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
      >
        <option value="">All entity types</option>
        {ENTITY_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

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
        </div>
      )}
    </div>
  );
}
