import { apiFetch } from "./client";
import type { PublicUser } from "@/types/api";

export type OtpPurpose = "REGISTER" | "PIN_RESET";

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

export type LoginResult =
  | { mfaRequired: true; mfaPendingToken: string }
  | ({ mfaRequired: false } & AuthResult);

export function requestOtp(
  phone: string,
  purpose: OtpPurpose,
  email?: string,
): Promise<{ success: true }> {
  return apiFetch("/auth/otp/request", { method: "POST", body: { phone, purpose, email } });
}

export function verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<{ success: true }> {
  return apiFetch("/auth/otp/verify", { method: "POST", body: { phone, purpose, code } });
}

export async function registerUser(params: {
  phone: string;
  email: string;
  fullName: string;
  pin: string;
  referralCode?: string;
}): Promise<AuthResult> {
  const res = await apiFetch<{ success: true; data: AuthResult }>("/auth/register", {
    method: "POST",
    body: params,
  });
  return res.data;
}

export async function login(params: { phone: string; pin: string }): Promise<LoginResult> {
  const res = await apiFetch<{ success: true; data: LoginResult }>("/auth/login", {
    method: "POST",
    body: params,
  });
  return res.data;
}

export async function mfaLoginVerify(mfaPendingToken: string, code: string): Promise<AuthResult> {
  const res = await apiFetch<{ success: true; data: AuthResult }>("/auth/mfa/login-verify", {
    method: "POST",
    body: { mfaPendingToken, code },
  });
  return res.data;
}

export async function beginMfaSetup(
  accessToken: string,
): Promise<{ secret: string; otpauthUrl: string }> {
  const res = await apiFetch<{ success: true; data: { secret: string; otpauthUrl: string } }>(
    "/auth/mfa/setup",
    { method: "POST", accessToken },
  );
  return res.data;
}

export function confirmMfaSetup(accessToken: string, code: string): Promise<{ success: true }> {
  return apiFetch("/auth/mfa/verify-setup", { method: "POST", accessToken, body: { code } });
}

export function disableMfa(accessToken: string, code: string): Promise<{ success: true }> {
  return apiFetch("/auth/mfa/disable", { method: "POST", accessToken, body: { code } });
}

export async function refreshSession(): Promise<{ accessToken: string }> {
  const res = await apiFetch<{ success: true; data: { accessToken: string } }>("/auth/refresh", {
    method: "POST",
  });
  return res.data;
}

export function logout(): Promise<{ success: true }> {
  return apiFetch("/auth/logout", { method: "POST" });
}
