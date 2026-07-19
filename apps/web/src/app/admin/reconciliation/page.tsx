"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api/client";
import { formatNaira } from "@/lib/constants";
import { listReconciliationRuns, runReconciliationNow } from "@/lib/api/admin/reconciliation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ReconciliationRunView } from "@/types/api";

function DriftAmount({ amount }: { amount: number }) {
  if (amount === 0) return <span className="text-success">₦0</span>;
  return <span className="font-semibold text-danger">{amount > 0 ? "+" : ""}{formatNaira(amount)}</span>;
}

export default function AdminReconciliationPage() {
  const { accessToken } = useAuth();
  const [runs, setRuns] = useState<ReconciliationRunView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await listReconciliationRuns(accessToken);
        if (!cancelled) {
          setRuns(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load reconciliation runs.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleRunNow() {
    if (!accessToken) return;
    setIsRunning(true);
    setError(null);
    try {
      const run = await runReconciliationNow(accessToken);
      setRuns((prev) => [run, ...prev]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reconciliation run failed.");
    } finally {
      setIsRunning(false);
    }
  }

  const latest = runs[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Treasury Reconciliation</h1>
          <p className="mt-1 text-sm text-muted">
            Recomputes each balance from its ledger history and compares it against the running counter.
            A healthy system always shows zero drift — every ledger write updates its counter atomically,
            so nonzero drift means something outside that path touched the data.
          </p>
        </div>
        <Button variant="primary" className="px-4 py-2 text-sm" isLoading={isRunning} onClick={() => void handleRunNow()}>
          Run now
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {latest ? (
        <div
          className={`rounded-2xl border p-6 ${
            latest.hasDiscrepancy ? "border-danger bg-danger/5" : "border-border bg-background"
          }`}
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Latest run</p>
            <Badge tone={latest.hasDiscrepancy ? "danger" : "success"}>
              {latest.hasDiscrepancy ? "Discrepancy found" : "Balanced"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {new Date(latest.runAt).toLocaleString()} · {latest.triggeredBy === "MANUAL" ? "Manually triggered" : "Scheduled"}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Treasury (pot)</p>
              <p className="mt-1 text-foreground">{formatNaira(latest.treasuryBalanceActual)}</p>
              <p className="text-xs text-muted">Drift: <DriftAmount amount={latest.treasuryDrift} /></p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Referral pool</p>
              <p className="mt-1 text-foreground">{formatNaira(latest.referralPoolActual)}</p>
              <p className="text-xs text-muted">Drift: <DriftAmount amount={latest.referralPoolDrift} /></p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Incentive pool</p>
              <p className="mt-1 text-foreground">{formatNaira(latest.incentivePoolActual)}</p>
              <p className="text-xs text-muted">Drift: <DriftAmount amount={latest.incentivePoolDrift} /></p>
            </div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted">Loading run history…</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted">No reconciliation runs yet — the first scheduled run happens at midnight, or click &quot;Run now&quot;.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Run at</th>
                <th className="px-4 py-3 font-semibold">Trigger</th>
                <th className="px-4 py-3 font-semibold">Treasury drift</th>
                <th className="px-4 py-3 font-semibold">Referral pool drift</th>
                <th className="px-4 py-3 font-semibold">Incentive pool drift</th>
                <th className="px-4 py-3 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-3 text-muted">{new Date(run.runAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted">{run.triggeredBy === "MANUAL" ? "Manual" : "Scheduled"}</td>
                  <td className="px-4 py-3"><DriftAmount amount={run.treasuryDrift} /></td>
                  <td className="px-4 py-3"><DriftAmount amount={run.referralPoolDrift} /></td>
                  <td className="px-4 py-3"><DriftAmount amount={run.incentivePoolDrift} /></td>
                  <td className="px-4 py-3">
                    <Badge tone={run.hasDiscrepancy ? "danger" : "success"}>
                      {run.hasDiscrepancy ? "Discrepancy" : "Balanced"}
                    </Badge>
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
