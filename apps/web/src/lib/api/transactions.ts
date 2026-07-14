import { apiFetch } from "./client";
import type { TransactionDetail } from "@/types/api";

export async function getTransaction(
  accessToken: string,
  transactionId: string,
): Promise<TransactionDetail> {
  const res = await apiFetch<{ success: true; data: TransactionDetail }>(
    `/transactions/${transactionId}`,
    { accessToken },
  );
  return res.data;
}

export async function uploadProof(
  accessToken: string,
  transactionId: string,
  file: File,
): Promise<TransactionDetail> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch<{ success: true; data: TransactionDetail }>(
    `/transactions/${transactionId}/proof`,
    { method: "POST", accessToken, body: formData },
  );
  return res.data;
}

export async function getProofUrl(accessToken: string, transactionId: string): Promise<string> {
  const res = await apiFetch<{ success: true; data: { url: string } }>(
    `/transactions/${transactionId}/proof-url`,
    { accessToken },
  );
  return res.data.url;
}

export async function confirmReceipt(
  accessToken: string,
  transactionId: string,
): Promise<TransactionDetail> {
  const res = await apiFetch<{ success: true; data: TransactionDetail }>(
    `/transactions/${transactionId}/confirm`,
    { method: "POST", accessToken },
  );
  return res.data;
}

export async function raiseDispute(
  accessToken: string,
  transactionId: string,
  reason: string,
): Promise<TransactionDetail> {
  const res = await apiFetch<{ success: true; data: TransactionDetail }>(
    `/transactions/${transactionId}/dispute`,
    { method: "POST", accessToken, body: { reason } },
  );
  return res.data;
}
