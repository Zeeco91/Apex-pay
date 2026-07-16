import { apiFetch } from "../client";
import type {
  AdminLevelIncentiveBonusView,
  AdminReferralBonusView,
  AdminWithdrawalRequestView,
  FeePoolView,
  ReferralBonusStatus,
  WithdrawalRequestStatus,
} from "@/types/api";

export async function listFeePools(accessToken: string): Promise<FeePoolView[]> {
  const res = await apiFetch<{ success: true; data: FeePoolView[] }>("/admin/fee-pools", {
    accessToken,
  });
  return res.data;
}

export async function listReferralBonusesForAdmin(
  accessToken: string,
  status?: ReferralBonusStatus,
): Promise<AdminReferralBonusView[]> {
  const res = await apiFetch<{ success: true; data: AdminReferralBonusView[] }>(
    `/admin/referral-bonuses${status ? `?status=${status}` : ""}`,
    { accessToken },
  );
  return res.data;
}

export async function listLevelIncentiveBonusesForAdmin(
  accessToken: string,
): Promise<AdminLevelIncentiveBonusView[]> {
  const res = await apiFetch<{ success: true; data: AdminLevelIncentiveBonusView[] }>(
    "/admin/level-incentive-bonuses",
    { accessToken },
  );
  return res.data;
}

export async function listWithdrawalRequestsForAdmin(
  accessToken: string,
  status?: WithdrawalRequestStatus,
): Promise<AdminWithdrawalRequestView[]> {
  const res = await apiFetch<{ success: true; data: AdminWithdrawalRequestView[] }>(
    `/admin/withdrawal-requests${status ? `?status=${status}` : ""}`,
    { accessToken },
  );
  return res.data;
}

export async function approveWithdrawal(
  accessToken: string,
  id: string,
): Promise<AdminWithdrawalRequestView> {
  const res = await apiFetch<{ success: true; data: AdminWithdrawalRequestView }>(
    `/admin/withdrawal-requests/${id}/approve`,
    { method: "POST", accessToken },
  );
  return res.data;
}

export async function rejectWithdrawal(
  accessToken: string,
  id: string,
  reason: string,
): Promise<AdminWithdrawalRequestView> {
  const res = await apiFetch<{ success: true; data: AdminWithdrawalRequestView }>(
    `/admin/withdrawal-requests/${id}/reject`,
    { method: "POST", accessToken, body: { reason } },
  );
  return res.data;
}

export async function markWithdrawalPaid(
  accessToken: string,
  id: string,
  reference: string,
): Promise<AdminWithdrawalRequestView> {
  const res = await apiFetch<{ success: true; data: AdminWithdrawalRequestView }>(
    `/admin/withdrawal-requests/${id}/mark-paid`,
    { method: "POST", accessToken, body: { reference } },
  );
  return res.data;
}
