export type SupportChatBlockReason =
  | "role"
  | "disabled"
  | "checking"
  | "unavailable"
  | "blocked";

export interface SupportChatWriteState {
  canWrite: boolean;
  reason: SupportChatBlockReason | null;
}

type ChatCapabilityLike = {
  canUseSupportChat?: boolean;
  supportChatEnabled?: boolean;
} | null | undefined;

/**
 * Write access for an existing support conversation. Historical support
 * threads remain readable for everyone; composing/uploading is professional
 * only and requires the superadmin flag. Ordinary marketplace conversations
 * do not use this guard.
 */
export function resolveSupportChatWriteState(
  role: string | undefined | null,
  capabilities: ChatCapabilityLike,
  options: { loading?: boolean; failed?: boolean; blocked?: boolean } = {},
): SupportChatWriteState {
  if (role !== "professional") return { canWrite: false, reason: "role" };
  if (options.loading) return { canWrite: false, reason: "checking" };
  if (options.failed || !capabilities) {
    return { canWrite: false, reason: "unavailable" };
  }
  if (
    capabilities.supportChatEnabled !== true ||
    capabilities.canUseSupportChat !== true
  ) {
    return { canWrite: false, reason: "disabled" };
  }
  if (options.blocked) return { canWrite: false, reason: "blocked" };
  return { canWrite: true, reason: null };
}

/**
 * A 403 from send/upload means the server-side flag or professional gate
 * changed after the capability fetch. Surface a disabled state immediately;
 * the capability is re-fetched rather than trusting the stale payload.
 */
export function supportChatBlockReasonFromError(
  error: unknown,
): "role" | "disabled" | null {
  const candidate = (error || {}) as {
    status?: unknown;
    serverMessage?: unknown;
    message?: unknown;
  };
  if (candidate.status !== 403) return null;
  const message = `${candidate.serverMessage || ""} ${candidate.message || ""}`.toLowerCase();
  if (message.includes("professional")) return "role";
  return "disabled";
}
