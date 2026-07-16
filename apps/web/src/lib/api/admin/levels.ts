import { apiFetch } from "../client";
import type { AdminLevel } from "@/types/api";

export async function listLevelsForAdmin(accessToken: string): Promise<AdminLevel[]> {
  const res = await apiFetch<{ success: true; data: AdminLevel[] }>("/admin/levels", {
    accessToken,
  });
  return res.data;
}

export type UpdateLevelPayload = Partial<
  Pick<
    AdminLevel,
    | "name"
    | "contributionAmount"
    | "feePercent"
    | "referralPoolAllocationPercentOfFee"
    | "incentivePoolAllocationPercentOfFee"
    | "platformRevenuePercentOfFee"
    | "incentiveBonusRateOfPrincipal"
    | "stalledThresholdDays"
    | "isActive"
  >
>;

export async function updateLevel(
  accessToken: string,
  levelId: string,
  payload: UpdateLevelPayload,
): Promise<AdminLevel> {
  const res = await apiFetch<{ success: true; data: AdminLevel }>(`/admin/levels/${levelId}`, {
    method: "PATCH",
    accessToken,
    body: payload,
  });
  return res.data;
}
