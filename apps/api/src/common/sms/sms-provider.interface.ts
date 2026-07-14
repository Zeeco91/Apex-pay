/**
 * Swappable SMS transport (plan §1: "Termii primary, Twilio fallback, behind a common
 * interface"). Business logic (OTP service) depends only on this token/interface —
 * swapping providers later never touches auth logic.
 */
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}
