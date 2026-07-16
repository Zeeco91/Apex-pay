import { apiFetch } from "../client";
import type { AdminKycRecordView, KycStatus } from "@/types/api";

export async function listKycRecords(
  accessToken: string,
  status?: KycStatus,
): Promise<AdminKycRecordView[]> {
  const res = await apiFetch<{ success: true; data: AdminKycRecordView[] }>(
    `/admin/kyc${status ? `?status=${status}` : ""}`,
    { accessToken },
  );
  return res.data;
}

export async function approveKyc(
  accessToken: string,
  kycRecordId: string,
): Promise<AdminKycRecordView> {
  const res = await apiFetch<{ success: true; data: AdminKycRecordView }>(
    `/admin/kyc/${kycRecordId}/approve`,
    { method: "POST", accessToken },
  );
  return res.data;
}

export async function rejectKyc(
  accessToken: string,
  kycRecordId: string,
  reason: string,
): Promise<AdminKycRecordView> {
  const res = await apiFetch<{ success: true; data: AdminKycRecordView }>(
    `/admin/kyc/${kycRecordId}/reject`,
    { method: "POST", accessToken, body: { reason } },
  );
  return res.data;
}
