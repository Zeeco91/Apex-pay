"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { AdminLevel } from "@/types/api";
import type { UpdateLevelPayload } from "@/lib/api/admin/levels";

interface LevelEditCardProps {
  level: AdminLevel;
  onSave: (payload: UpdateLevelPayload) => Promise<void>;
}

export function LevelEditCard({ level, onSave }: LevelEditCardProps) {
  const [form, setForm] = useState({
    name: level.name,
    contributionAmount: level.contributionAmount,
    feePercent: level.feePercent,
    referralPoolAllocationPercentOfFee: level.referralPoolAllocationPercentOfFee,
    incentivePoolAllocationPercentOfFee: level.incentivePoolAllocationPercentOfFee,
    platformRevenuePercentOfFee: level.platformRevenuePercentOfFee,
    incentiveBonusRateOfPrincipal: level.incentiveBonusRateOfPrincipal,
    stalledThresholdDays: level.stalledThresholdDays,
    isActive: level.isActive,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const percentSum =
    form.referralPoolAllocationPercentOfFee +
    form.incentivePoolAllocationPercentOfFee +
    form.platformRevenuePercentOfFee;
  const percentSumValid = Math.abs(percentSum - 100) < 0.01;

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (!percentSumValid) {
      setError(`Referral + incentive + platform-revenue percentages must sum to 100 (currently ${percentSum}).`);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(form);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save level.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold text-foreground">{level.name}</p>
        <Badge tone={level.isActive ? "success" : "neutral"}>{level.isActive ? "Active" : "Inactive"}</Badge>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Name" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
        <Input
          label="Contribution amount (₦)"
          type="number"
          value={form.contributionAmount}
          onChange={(e) => updateField("contributionAmount", Number(e.target.value))}
        />
        <Input
          label="Platform fee (%)"
          type="number"
          value={form.feePercent}
          onChange={(e) => updateField("feePercent", Number(e.target.value))}
        />
        <Input
          label="Referral pool allocation (% of fee)"
          type="number"
          value={form.referralPoolAllocationPercentOfFee}
          onChange={(e) => updateField("referralPoolAllocationPercentOfFee", Number(e.target.value))}
        />
        <Input
          label="Incentive pool allocation (% of fee)"
          type="number"
          value={form.incentivePoolAllocationPercentOfFee}
          onChange={(e) => updateField("incentivePoolAllocationPercentOfFee", Number(e.target.value))}
        />
        <Input
          label="Platform revenue (% of fee)"
          type="number"
          value={form.platformRevenuePercentOfFee}
          onChange={(e) => updateField("platformRevenuePercentOfFee", Number(e.target.value))}
        />
        <Input
          label="Incentive bonus rate (% of principal)"
          type="number"
          value={form.incentiveBonusRateOfPrincipal}
          onChange={(e) => updateField("incentiveBonusRateOfPrincipal", Number(e.target.value))}
        />
        <Input
          label="Stalled threshold (days)"
          type="number"
          value={form.stalledThresholdDays}
          onChange={(e) => updateField("stalledThresholdDays", Number(e.target.value))}
        />
        <div className="flex items-end gap-2 pb-2">
          <input
            id={`active-${level.id}`}
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => updateField("isActive", e.target.checked)}
          />
          <label htmlFor={`active-${level.id}`} className="text-sm text-foreground">
            Accepting new members
          </label>
        </div>
      </div>

      <p className={`mt-3 text-xs ${percentSumValid ? "text-muted" : "text-danger"}`}>
        Referral + incentive + platform-revenue = {percentSum}% {percentSumValid ? "" : "(must equal 100%)"}
      </p>

      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {saved ? <p className="mt-2 text-sm text-success">Saved.</p> : null}

      <div className="mt-4">
        <Button variant="primary" className="px-4 py-2 text-xs" isLoading={isSaving} onClick={() => void handleSave()}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
