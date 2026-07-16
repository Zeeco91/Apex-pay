import { apiFetch } from "./client";
import type { ReferralBonusSummary, ReferredUserSummary, WithdrawalRequestView } from "@/types/api";

export async function getMyReferrals(accessToken: string): Promise<ReferredUserSummary[]> {
  const res = await apiFetch<{ success: true; data: ReferredUserSummary[] }>("/referrals", {
    accessToken,
  });
  return res.data;
}

export async function getMyReferralBonuses(accessToken: string): Promise<ReferralBonusSummary[]> {
  const res = await apiFetch<{ success: true; data: ReferralBonusSummary[] }>("/referral-bonuses", {
    accessToken,
  });
  return res.data;
}

export async function requestWithdrawal(
  accessToken: string,
  referralBonusId: string,
): Promise<WithdrawalRequestView> {
  const res = await apiFetch<{ success: true; data: WithdrawalRequestView }>(
    "/referral-bonuses/withdrawals",
    { method: "POST", accessToken, body: { referralBonusId } },
  );
  return res.data;
}

export async function getMyWithdrawalRequests(accessToken: string): Promise<WithdrawalRequestView[]> {
  const res = await apiFetch<{ success: true; data: WithdrawalRequestView[] }>(
    "/referral-bonuses/withdrawals",
    { accessToken },
  );
  return res.data;
}
