import type { SupportCalendarEvent } from "../support";

export interface SupportCalendarDisplayEvent {
  id: string;
  status: "pending" | "scheduled";
  pending: boolean;
  start: string;
  end: string;
  ticketNumber: string | null;
  subject: string;
}

/**
 * Normalises the canonical support-calendar feed into display-safe events.
 * Pending (reserved, link not yet added) and scheduled meetings both block
 * real time and are shown; cancelled/completed/declined rows are not events.
 * Admin views can restrict to the signed-in admin's assigned meetings.
 */
export function supportCalendarDisplayEvents(
  events: readonly SupportCalendarEvent[] | null | undefined,
  options: { assignedAdminId?: string | null } = {},
): SupportCalendarDisplayEvent[] {
  const assigned = options.assignedAdminId ? String(options.assignedAdminId) : null;
  const result: SupportCalendarDisplayEvent[] = [];
  for (const event of events || []) {
    if (event.status !== "pending" && event.status !== "scheduled") continue;
    if (assigned && (!event.admin?.id || String(event.admin.id) !== assigned)) {
      continue;
    }
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end.getTime() <= start.getTime()
    ) {
      continue;
    }
    result.push({
      id: String(event.id),
      status: event.status,
      pending: event.status === "pending",
      start: start.toISOString(),
      end: end.toISOString(),
      ticketNumber: event.ticketNumber || null,
      subject: event.subject || "",
    });
  }
  return result.sort(
    (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
  );
}

/**
 * One warning sentence plus at most one distinct safe detail. The detail is
 * the localized/sanitized error text; when the fallback already equals the
 * heading, do not print the same sentence twice.
 */
export function supportCalendarWarning(
  heading: string,
  detail: string | null | undefined,
): string {
  const title = heading.trim();
  const extra = detail?.trim();
  if (!extra || extra === title) return title;
  return `${title} ${extra}`;
}
