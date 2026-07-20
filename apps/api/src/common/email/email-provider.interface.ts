/**
 * Swappable email transport, mirroring SmsProvider (../sms/sms-provider.interface.ts).
 * Business logic (OtpService) depends only on this token/interface — swapping providers,
 * or moving back to SMS-only once that's fixed, never touches auth logic.
 */
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProvider {
  sendOtp(email: string, code: string): Promise<void>;
}
