import { apiFetch } from "./client";
import type { PayoutBankDetails, PublicUser } from "@/types/api";

export async function getMe(accessToken: string): Promise<PublicUser> {
  const res = await apiFetch<{ success: true; data: PublicUser }>("/users/me", { accessToken });
  return res.data;
}

export async function updatePayoutBankDetails(
  accessToken: string,
  details: PayoutBankDetails,
): Promise<PublicUser> {
  const res = await apiFetch<{ success: true; data: PublicUser }>("/users/me/payout-bank-details", {
    method: "PATCH",
    accessToken,
    body: details,
  });
  return res.data;
}
