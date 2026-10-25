import { formatInTimeZone } from "date-fns-tz";

export interface SupportSlotLike {
  start: string;
  end: string;
  localStart?: string;
  localEnd?: string;
}

export function resolveSupportTimeZone(value?: string | null): string {
  if (value) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
      return value;
    } catch {
      // Fall through to the browser zone.
    }
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Local calendar date (YYYY-MM-DD) of an instant in the viewer zone. */
export function supportLocalDate(
  value: Date | string,
  timeZone: string,
): string {
  const date = value instanceof Date ? value : new Date(value);
  const zone = resolveSupportTimeZone(timeZone);
  try {
    return formatInTimeZone(date, zone, "yyyy-MM-dd");
  } catch {
    return formatInTimeZone(date, "UTC", "yyyy-MM-dd");
  }
}

/** Adds days to an ISO calendar date without DST/browser-timezone drift. */
export function addSupportDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Inclusive local calendar date window, starting today in the viewer zone. */
export function supportDateWindow(
  timeZone: string,
  days = 21,
  now: Date = new Date(),
): { from: string; to: string; dates: string[] } {
  const normalizedDays = Math.max(1, Math.min(31, Math.trunc(days)));
  const from = supportLocalDate(now, timeZone);
  const to = addSupportDays(from, normalizedDays - 1);
  const dates: string[] = [];
  for (let index = 0; index < normalizedDays; index += 1) {
    dates.push(addSupportDays(from, index));
  }
  return { from, to, dates };
}

export function groupSupportSlotsByDate<T extends SupportSlotLike>(
  slots: readonly T[],
  timeZone: string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  const ordered = [...slots].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
  for (const slot of ordered) {
    if (!Number.isFinite(new Date(slot.start).getTime())) continue;
    const date = supportLocalDate(slot.start, timeZone);
    const current = grouped.get(date) || [];
    current.push(slot);
    grouped.set(date, current);
  }
  return grouped;
}

const DEFAULT_LOCALE = "en-GB";

function safeFormat(
  value: Date | string,
  timeZone: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale || DEFAULT_LOCALE, {
      ...options,
      timeZone: resolveSupportTimeZone(timeZone),
    }).format(date);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale || DEFAULT_LOCALE, {
        ...options,
        timeZone: "UTC",
      }).format(date);
    } catch {
      return date.toISOString();
    }
  }
}

export function formatSupportDateTime(
  value: Date | string,
  timeZone: string,
  locale?: string,
): string {
  return safeFormat(value, timeZone, locale || DEFAULT_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSupportTime(
  value: Date | string,
  timeZone: string,
  locale?: string,
): string {
  return safeFormat(value, timeZone, locale || DEFAULT_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSupportDateOnly(isoDate: string, locale?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0),
  );
  return safeFormat(date, "UTC", locale || DEFAULT_LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function isFutureMeeting(
  scheduledAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!scheduledAt) return false;
  const date = new Date(scheduledAt);
  return Number.isFinite(date.getTime()) && date.getTime() > now.getTime();
}
