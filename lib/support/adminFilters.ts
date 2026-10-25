/**
 * Client-side mirror of the structured admin support inbox filters.
 *
 * This is only used to drop a card immediately after a successful mutation so
 * the visible list cannot contradict its status while the authoritative server
 * query refreshes. The server query remains the source of truth; free-text
 * search is deliberately not evaluated here.
 */
export interface AdminSupportFilterState {
  q?: string;
  status?: string;
  userType?: string;
  reason?: string;
  booking?: string;
  kind?: string;
  meeting?: string;
}

interface SupportFilterItemLike {
  kind: "ticket" | "meeting";
  status?: string | null;
  ticketStatus?: string | null;
  requesterRole?: string | null;
  reason?: string | null;
  ticketNumber?: string | null;
  subject?: string | null;
  booking?: {
    _id?: string | null;
    id?: string | null;
    bookingNumber?: string | null;
  } | null;
  meeting?: {
    status?: string | null;
    scheduledAt?: string | null;
  } | null;
}

const TICKET_STATUSES = new Set(["open", "in_progress", "resolved", "closed"]);
const MEETING_STATUSES = new Set([
  "pending",
  "scheduled",
  "declined",
  "cancelled",
  "completed",
]);

export function adminSupportItemMatchesFilters(
  item: SupportFilterItemLike | null | undefined,
  filters: AdminSupportFilterState,
): boolean {
  if (!item) return false;

  const kind = filters.kind === "ticket" || filters.kind === "meeting" ? filters.kind : "";
  if (kind && item.kind !== kind) return false;

  if (filters.status) {
    if (TICKET_STATUSES.has(filters.status)) {
      // The server scopes ticket statuses to ticket rows: a scheduled meeting
      // has ticketStatus=open but must not appear under the "open" filter.
      if (item.kind === "meeting") return false;
      if ((item.ticketStatus || item.status) !== filters.status) return false;
    } else if (MEETING_STATUSES.has(filters.status)) {
      if (item.kind !== "meeting") return false;
      if ((item.meeting?.status || item.status) !== filters.status) return false;
    } else {
      return false;
    }
  }

  if (filters.userType && item.requesterRole !== filters.userType) return false;
  if (filters.reason && item.reason !== filters.reason) return false;

  const bookingRef = filters.booking?.trim();
  if (bookingRef) {
    const booking = item.booking;
    const bookingIds = [booking?._id, booking?.id, booking?.bookingNumber]
      .filter((value): value is string => Boolean(value))
      .map((value) => String(value));
    if (!bookingIds.includes(bookingRef)) return false;
  }

  if (filters.meeting === "with") {
    if (item.kind !== "meeting" || !item.meeting?.scheduledAt) return false;
  } else if (filters.meeting === "without") {
    if (item.kind === "meeting" && item.meeting?.scheduledAt) return false;
  }

  return true;
}
