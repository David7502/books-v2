export const MAX_COVER_BYTES = 2 * 1024 * 1024;

export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type CoverType = (typeof COVER_TYPES)[number];

const TYPE_ERROR = "Choisis une image JPEG, PNG ou WebP.";
const SIZE_ERROR = "L'image dépasse 2 Mo.";
const MISMATCH_ERROR = "Le type annoncé ne correspond pas à l'image.";

export function detectCoverType(bytes: Uint8Array): CoverType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function announcedCoverType(value: string | null | undefined): CoverType | null {
  const type = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  return COVER_TYPES.find((item) => item === type) ?? null;
}

export function validateCoverBytes(
  bytes: Uint8Array,
  announced: string | null | undefined,
): { ok: true; contentType: CoverType } | { ok: false; error: string } {
  if (bytes.byteLength === 0) {
    return { ok: false, error: "L'image est vide." };
  }
  if (bytes.byteLength > MAX_COVER_BYTES) {
    return { ok: false, error: SIZE_ERROR };
  }
  const detected = detectCoverType(bytes);
  if (!detected) {
    return { ok: false, error: TYPE_ERROR };
  }
  if (announcedCoverType(announced) !== detected) {
    return { ok: false, error: MISMATCH_ERROR };
  }
  return { ok: true, contentType: detected };
}

export function coverFileError(file: { size: number; type: string }): string | null {
  if (file.size === 0) {
    return "L'image est vide.";
  }
  if (file.size > MAX_COVER_BYTES) {
    return SIZE_ERROR;
  }
  if (!announcedCoverType(file.type)) {
    return TYPE_ERROR;
  }
  return null;
}
