export const VOUCHER_FILE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const VOUCHER_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
] as const;

export const VOUCHER_ALLOWED_BUCKET_MIME_TYPES = [
  ...VOUCHER_ALLOWED_MIME_TYPES,
  "application/pdf",
] as const;

export const VOUCHER_ACCEPT_ATTRIBUTE = [
  ...VOUCHER_ALLOWED_MIME_TYPES,
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".avif",
].join(",");

export const VOUCHER_ALLOWED_FILE_TYPES_LABEL =
  "JPG, PNG, WEBP, HEIC, HEIF o AVIF";

const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
};

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
};

export type VoucherFileLike = {
  name?: string | null;
  type?: string | null;
};

export function getVoucherFileExtension(file: VoucherFileLike) {
  const rawName = String(file.name || "");
  const extension = rawName.includes(".")
    ? rawName.split(".").pop()?.trim().toLowerCase() || ""
    : "";

  if (extension && EXTENSION_TO_MIME_TYPE[extension]) return extension;

  const mimeType = normalizeVoucherMimeType(file.type);
  return mimeType ? MIME_TYPE_TO_EXTENSION[mimeType] || "" : "";
}

export function normalizeVoucherMimeType(type?: string | null) {
  const mimeType = String(type || "").trim().toLowerCase();
  return VOUCHER_ALLOWED_MIME_TYPES.includes(mimeType as any) ? mimeType : "";
}

export function inferVoucherMimeType(file: VoucherFileLike) {
  const normalizedType = normalizeVoucherMimeType(file.type);
  if (normalizedType) return normalizedType;

  const extension = getVoucherFileExtension(file);
  return extension ? EXTENSION_TO_MIME_TYPE[extension] || "" : "";
}

export function isAllowedVoucherFile(file: VoucherFileLike) {
  return Boolean(inferVoucherMimeType(file));
}
