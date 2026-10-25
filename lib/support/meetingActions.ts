/**
 * Pure request-shape helpers for the admin manual meeting-link contract.
 * Kept dependency-free so the exact wire payload is unit-testable.
 */
export interface AdminSupportMeetingAction {
  action: "cancel" | "reschedule" | "complete" | "set_link";
  scheduledAt?: string;
  timeZone?: string;
  reason?: string;
  meetingLink?: string;
}

const BASE_PATH = "/api/admin/support/items";

export function adminSupportMeetingPath(
  kind: "ticket" | "meeting",
  id: string,
): string {
  return `${BASE_PATH}/${kind}/${encodeURIComponent(id)}/meeting`;
}

/** Exact request body for the admin support meeting PATCH contract. */
export function buildAdminSupportMeetingBody(
  action: AdminSupportMeetingAction,
): { meeting: AdminSupportMeetingAction } {
  return { meeting: action };
}
