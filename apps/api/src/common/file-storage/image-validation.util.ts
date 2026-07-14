import { BadRequestException } from '@nestjs/common';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

interface ImageSignature {
  mime: string;
  extension: string;
  magic: number[];
}

const SIGNATURES: ImageSignature[] = [
  { mime: 'image/jpeg', extension: 'jpg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', extension: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', extension: 'webp', magic: [0x52, 0x49, 0x46, 0x46] }, // "RIFF", WEBP checked separately below
];

/**
 * MIME + magic-byte + size validation (plan §7). EXIF stripping is deliberately deferred — it
 * needs an image-processing library (e.g. sharp) that isn't a dependency yet; tracked as a
 * hardening-phase gap rather than hand-rolled here.
 */
export function validateProofImage(file: {
  buffer: Buffer;
  mimetype: string;
  size: number;
}): { extension: string } {
  if (file.size === 0) {
    throw new BadRequestException('Uploaded file is empty.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new BadRequestException('Proof image must be 5MB or smaller.');
  }

  const matched = SIGNATURES.find((sig) =>
    matchesMagicBytes(file.buffer, sig.magic),
  );
  const isRealWebp =
    matched?.mime === 'image/webp' &&
    file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!matched || (matched.mime === 'image/webp' && !isRealWebp)) {
    throw new BadRequestException(
      'Proof image must be a JPEG, PNG, or WEBP file.',
    );
  }
  if (file.mimetype !== matched.mime) {
    throw new BadRequestException(
      'File content does not match its declared type.',
    );
  }

  return { extension: matched.extension };
}

function matchesMagicBytes(buffer: Buffer, magic: number[]): boolean {
  if (buffer.length < magic.length) return false;
  return magic.every((byte, index) => buffer[index] === byte);
}
