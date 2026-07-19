import { apiFetch } from "../client";
import type { FraudFlagsSummary } from "@/types/api";

export async function getFraudFlags(accessToken: string): Promise<FraudFlagsSummary> {
  const res = await apiFetch<{ success: true; data: FraudFlagsSummary }>("/admin/fraud-flags", {
    accessToken,
  });
  return res.data;
}
