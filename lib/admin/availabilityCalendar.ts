import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { normalizeTimezone } from '@/lib/timezoneDisplay'
import type { CalendarEvent } from '@/components/calendar/WeeklyAvailabilityCalendar'

export function resolveAdminAvailabilityTimeZone(
  value: string | undefined,
  fallback: string,
): string {
  return normalizeTimezone(value, fallback)
}

export function safeFormatInTimeZone(
  date: Date,
  timeZone: string,
  format: string,
  fallbackTimeZone: string,
): string {
  const resolved = resolveAdminAvailabilityTimeZone(timeZone, fallbackTimeZone)
  try {
    return formatInTimeZone(date, resolved, format)
  } catch {
    return formatInTimeZone(date, fallbackTimeZone, format)
  }
}

export function hasStoredScheduleTimes(
  availability: Record<string, { startTime?: string; endTime?: string } | undefined>,
): boolean {
  return Object.values(availability).some((day) => day?.startTime || day?.endTime)
}

export function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function buildBlockedCalendarEvents(
  blockedDates: Array<{ date: string; reason?: string }>,
  blockedRanges: Array<{ startDate: string; endDate: string; reason?: string }>,
  timeZone: string,
  fallbackTimeZone: string,
  idPrefix = 'admin-blocked',
): CalendarEvent[] {
  const resolvedTimeZone = resolveAdminAvailabilityTimeZone(timeZone, fallbackTimeZone)
  const events: CalendarEvent[] = []

  blockedDates.forEach((item, index) => {
    if (!item.date) return
    try {
      const start = fromZonedTime(`${item.date}T00:00:00`, resolvedTimeZone)
      const end = fromZonedTime(`${addIsoDays(item.date, 1)}T00:00:00`, resolvedTimeZone)
      events.push({
        id: `${idPrefix}-date-${index}`,
        type: 'company',
        title: item.reason ? `Blocked: ${item.reason}` : 'Blocked',
        start,
        end,
        readOnly: true,
      })
    } catch {
      // Skip invalid blocked dates when timezone is invalid.
    }
  })

  blockedRanges.forEach((range, index) => {
    const start = new Date(range.startDate)
    const end = new Date(range.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return
    events.push({
      id: `${idPrefix}-range-${index}`,
      type: 'company',
      title: range.reason ? `Blocked: ${range.reason}` : 'Blocked',
      start,
      end,
      readOnly: true,
    })
  })

  return events
}
