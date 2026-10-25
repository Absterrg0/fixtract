export type SupportRole = "customer" | "professional" | string | undefined;

export interface SupportChannelVisibility {
  ticket: boolean;
  /** Meeting tab: creation for professionals, owned history for every owner. */
  meeting: boolean;
  /** New meeting booking stays professional-only. */
  meetingCreation: boolean;
  chat: boolean;
}

export interface SupportChannelCapabilities {
  canCreateTicket?: boolean;
  canPlanMeeting?: boolean;
  canUseSupportChat?: boolean;
  /** New manual-link contract: booking is available before a link exists. */
  meetingBookingAvailable?: boolean;
}

/**
 * Effective tab visibility. The server remains authoritative; this only
 * mirrors its documented rules and fails closed for chat/meetings.
 *
 * Meeting history is owner data: a former professional whose account is now a
 * customer must still be able to find, join and cancel existing meetings. Only
 * creating a new meeting and support chat remain professional capabilities.
 * When capabilities are unavailable, a customer sees tickets + owned meeting
 * history and a professional sees tickets + meetings; chat stays hidden.
 */
export function resolveSupportChannels(
  role: SupportRole,
  capabilities?: SupportChannelCapabilities | null,
): SupportChannelVisibility {
  if (role !== "customer" && role !== "professional") {
    return { ticket: false, meeting: false, meetingCreation: false, chat: false };
  }

  const professional = role === "professional";
  if (!capabilities) {
    return {
      ticket: true,
      meeting: true,
      meetingCreation: professional,
      chat: false,
    };
  }

  return {
    ticket: capabilities.canCreateTicket !== false,
    meeting: true,
    meetingCreation:
      professional &&
      capabilities.canPlanMeeting === true &&
      capabilities.meetingBookingAvailable !== false,
    chat: professional && capabilities.canUseSupportChat === true,
  };
}

/**
 * The current API contract uses an admin-supplied manual meeting link.
 * `meetingLinkMode` is authoritative; the boolean is a compatible fallback.
 */
export function adminSuppliesMeetingLink(
  capabilities?: {
    meetingLinkMode?: string;
    meetingLinkSuppliedByAdmin?: boolean;
  } | null,
): boolean {
  if (!capabilities) return true;
  if (capabilities.meetingLinkMode) {
    return capabilities.meetingLinkMode === "manual";
  }
  return capabilities.meetingLinkSuppliedByAdmin !== false;
}
