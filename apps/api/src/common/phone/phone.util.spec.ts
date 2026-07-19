import { BadRequestException } from '@nestjs/common';
import { normalizePhoneOrThrow } from './phone.util';

describe('normalizePhoneOrThrow', () => {
  it('normalizes a local Nigerian number to E.164', () => {
    expect(normalizePhoneOrThrow('08012345678')).toBe('+2348012345678');
  });

  it('accepts an already-E.164 number unchanged', () => {
    expect(normalizePhoneOrThrow('+2348012345678')).toBe('+2348012345678');
  });

  it('rejects a number that is too short to be valid', () => {
    expect(() => normalizePhoneOrThrow('12345')).toThrow(BadRequestException);
  });

  it('rejects non-numeric garbage', () => {
    expect(() => normalizePhoneOrThrow('not-a-phone')).toThrow(
      BadRequestException,
    );
  });
});
