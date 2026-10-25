/** Attachment rules mirrored from the server's `rfqUpload` configuration. */
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const SUPPORT_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const SUPPORT_ATTACHMENT_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "pdf",
  "txt",
  "doc",
  "docx",
  "xls",
  "xlsx",
] as const;

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Infer the MIME type from an allowed extension when the browser omits it. */
export function supportAttachmentMimeForName(
  fileName: string | null | undefined,
): string | null {
  const extension = /\.([a-z0-9]+)$/i.exec((fileName || "").toLowerCase())?.[1];
  if (!extension) return null;
  return EXTENSION_MIME_TYPES[extension] || null;
}

export type SupportAttachmentError = "size" | "type" | null;

type FileLike = {
  name?: string;
  type?: string;
  size?: number;
};

/**
 * Fast client-side feedback only; the server performs the authoritative
 * magic-byte and size validation. A missing MIME type (common on some
 * browsers/OSes) is accepted when the extension is supported.
 */
export function validateSupportAttachment(file: FileLike): SupportAttachmentError {
  const size = Number(file.size) || 0;
  if (size > SUPPORT_ATTACHMENT_MAX_BYTES) return "size";
  if (size <= 0) return "type";

  const name = (file.name || "").toLowerCase();
  const extension = /\.([a-z0-9]+)$/.exec(name)?.[1] || "";
  const declaredType = (file.type || "").toLowerCase();
  // The server canonicalizes the legacy image/jpg alias to image/jpeg.
  const type = declaredType === "image/jpg" ? "image/jpeg" : declaredType;
  const extensionAllowed = (SUPPORT_ATTACHMENT_EXTENSIONS as readonly string[]).includes(
    extension,
  );
  const mimeAllowed =
    !type || (SUPPORT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(type);
  // The extension must always be allowed. A browser may omit the MIME type on
  // some platforms; that is accepted because the server validates the bytes.
  // An explicitly declared MIME type, however, must be on the allowlist.
  if (!extensionAllowed) return "type";
  if (type && !mimeAllowed) return "type";
  return null;
}

export function isValidSupportMeetingSlot(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime());
}

export const SUPPORT_MEETING_LINK_MAX_LENGTH = 500;

export type SupportMeetingLinkError =
  | "required"
  | "length"
  | "invalid"
  | "https"
  | "credentials"
  | null;

/**
 * Client-side mirror of the server's manual meeting-link validation. The
 * server remains authoritative; this only gives the admin fast feedback.
 * A meeting link must be a genuine absolute HTTPS URL without credentials.
 */
export function validateSupportMeetingLink(
  value: string | null | undefined,
): SupportMeetingLinkError {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "required";
  if (trimmed.length > SUPPORT_MEETING_LINK_MAX_LENGTH) return "length";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "invalid";
  }
  if (parsed.protocol !== "https:") return "https";
  if (parsed.username || parsed.password) return "credentials";
  if (!parsed.hostname) return "invalid";
  return null;
}

/** True only for a real, credentials-free absolute HTTPS meeting link. */
export function isSafeSupportMeetingLink(
  value: string | null | undefined,
): value is string {
  return validateSupportMeetingLink(value) === null;
}

/** Only absolute http(s) links may be rendered or opened. */
export function isSafeSupportUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
