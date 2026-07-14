import { apiFetch } from "./client";
import type { PublicUser } from "@/types/api";

export type OtpPurpose = "REGISTER" | "PIN_RESET";

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

export function requestOtp(phone: string, purpose: OtpPurpose): Promise<{ success: true }> {
  return apiFetch("/auth/otp/request", { method: "POST", body: { phone, purpose } });
}

export function verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<{ success: true }> {
  return apiFetch("/auth/otp/verify", { method: "POST", body: { phone, purpose, code } });
}

export async function registerUser(params: {
  phone: string;
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

export async function login(params: { phone: string; pin: string }): Promise<AuthResult> {
  const res = await apiFetch<{ success: true; data: AuthResult }>("/auth/login", {
    method: "POST",
    body: params,
  });
  return res.data;
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
