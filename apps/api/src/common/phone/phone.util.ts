import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberWithError } from 'libphonenumber-js';

/** Defaults to Nigeria since the platform targets Nigerian users (plan §7 — Termii SMS). */
const DEFAULT_COUNTRY = 'NG';

/** Normalizes to E.164 (the format `User.phone` is stored in, per plan §3) or throws BadRequestException. */
export function normalizePhoneOrThrow(rawPhone: string): string {
  try {
    const parsed = parsePhoneNumberWithError(rawPhone, DEFAULT_COUNTRY);
    if (!parsed.isValid()) {
      throw new Error('invalid');
    }
    return parsed.number;
  } catch {
    throw new BadRequestException('phone must be a valid phone number');
  }
}
