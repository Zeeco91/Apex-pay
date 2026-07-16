import { apiFetch } from "../client";
import type {
  AdminTransactionSummary,
  TransactionStatus,
  TreasuryLedgerEntryView,
} from "@/types/api";

export async function listTransactionsForAdmin(
  accessToken: string,
  status?: TransactionStatus,
): Promise<AdminTransactionSummary[]> {
  const res = await apiFetch<{ success: true; data: AdminTransactionSummary[] }>(
    `/admin/transactions${status ? `?status=${status}` : ""}`,
    { accessToken },
  );
  return res.data;
}

export async function confirmPrincipal(
  accessToken: string,
  transactionId: string,
): Promise<AdminTransactionSummary> {
  const res = await apiFetch<{ success: true; data: AdminTransactionSummary }>(
    `/admin/transactions/${transactionId}/confirm-principal`,
    { method: "POST", accessToken },
  );
  return res.data;
}

export async function disburseTransaction(
  accessToken: string,
  transactionId: string,
  reference: string,
): Promise<AdminTransactionSummary> {
  const res = await apiFetch<{ success: true; data: AdminTransactionSummary }>(
    `/admin/transactions/${transactionId}/disburse`,
    { method: "POST", accessToken, body: { reference } },
  );
  return res.data;
}

export async function resolveDispute(
  accessToken: string,
  transactionId: string,
  params: { resolution: "CONFIRMED" | "REJECTED"; notes: string },
): Promise<AdminTransactionSummary> {
  const res = await apiFetch<{ success: true; data: AdminTransactionSummary }>(
    `/admin/transactions/${transactionId}/resolve-dispute`,
    { method: "POST", accessToken, body: params },
  );
  return res.data;
}

export async function getTreasuryLedger(
  accessToken: string,
): Promise<TreasuryLedgerEntryView[]> {
  const res = await apiFetch<{ success: true; data: TreasuryLedgerEntryView[] }>(
    "/admin/treasury-ledger",
    { accessToken },
  );
  return res.data;
}
