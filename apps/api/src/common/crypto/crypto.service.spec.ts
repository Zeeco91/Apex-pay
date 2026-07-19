import type { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

function fakeConfig(
  encryptionKey: string,
): ConfigService<{ ENCRYPTION_KEY: string }, true> {
  return {
    get: () => encryptionKey,
  } as unknown as ConfigService<{ ENCRYPTION_KEY: string }, true>;
}

const TEST_KEY = '0'.repeat(63) + '1'; // 64 hex chars = 32 bytes, matches env.validation's regex

describe('CryptoService', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const crypto = new CryptoService(fakeConfig(TEST_KEY));
    const plaintext = 'a-sensitive-value-12345';
    const ciphertext = crypto.encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(crypto.decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext on repeated calls (random IV)', () => {
    const crypto = new CryptoService(fakeConfig(TEST_KEY));
    const a = crypto.encrypt('same input');
    const b = crypto.encrypt('same input');
    expect(a).not.toBe(b);
    expect(crypto.decrypt(a)).toBe('same input');
    expect(crypto.decrypt(b)).toBe('same input');
  });

  it('fails to decrypt with the wrong key (authentication tag mismatch)', () => {
    const encryptor = new CryptoService(fakeConfig(TEST_KEY));
    const ciphertext = encryptor.encrypt('secret');
    const wrongKey = '1'.repeat(63) + '0';
    const decryptor = new CryptoService(fakeConfig(wrongKey));
    expect(() => decryptor.decrypt(ciphertext)).toThrow();
  });

  it('rejects malformed ciphertext', () => {
    const crypto = new CryptoService(fakeConfig(TEST_KEY));
    expect(() => crypto.decrypt('not-valid-ciphertext')).toThrow(
      'Malformed ciphertext',
    );
  });
});
