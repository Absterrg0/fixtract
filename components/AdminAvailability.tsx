'use client'
import { getErrorMessage } from "@/lib/apiErrors"
import { adminListSupportAvailability } from "@/lib/support"
import { supportCalendarDisplayEvents, supportCalendarWarning } from "@/lib/support/calendar"
import { supportDateWindow } from "@/lib/support/dates"

import { useEffect, useMemo, useState } from 'react'
import { fromZonedTime } from 'date-fns-tz'
import { CalendarDays, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import WeeklyAvailabilityCalendar, { type CalendarEvent } from '@/components/calendar/WeeklyAvailabilityCalendar'
import {
  buildBlockedCalendarEvents,
  defaultAdminDaySchedule,
  hasStoredScheduleTimes,
  mergeAdminDaySchedule,
  parseClockTime,
  resolveAdminAvailabilityTimeZone,
  safeFormatInTimeZone,
} from '@/lib/admin/availabilityCalendar'

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
type DaySchedule = { available: boolean; startTime?: string; endTime?: string }
type BlockedDate = { date: string; reason?: string }
type BlockedRange = { startDate: string; endDate: string; reason?: string }

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: 'monday', label: 'Monday' }, { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' }, { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' }, { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

const defaultAvailability = (): Record<DayKey, DaySchedule> => Object.fromEntries(
  DAYS.map(({ key }) => [key, defaultAdminDaySchedule(key)]),
) as Record<DayKey, DaySchedule>

function mergeLoadedAvailability(loaded: unknown): Record<DayKey, DaySchedule> {
  const raw = loaded && typeof loaded === 'object' ? loaded as Record<string, DaySchedule> : {}
  return Object.fromEntries(
    DAYS.map(({ key }) => [key, mergeAdminDaySchedule(key, raw[key])]),
  ) as Record<DayKey, DaySchedule>
}

export default function AdminAvailability() {
  const { checkAuth, user } = useAuth()
  const { supportAccess } = useAdminAccess()
  const [availability, setAvailability] = useState(defaultAvailability)
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([])
  const [supportMeetingEvents, setSupportMeetingEvents] = useState<CalendarEvent[]>([])
  const [supportEventsError, setSupportEventsError] = useState<string | null>(null)
  const [supportEventsReloadKey, setSupportEventsReloadKey] = useState(0)
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [newDate, setNewDate] = useState<BlockedDate>({ date: '', reason: '' })
  const [newRange, setNewRange] = useState<BlockedRange>({ startDate: '', endDate: '', reason: '' })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const viewerTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])
  const resolvedTimeZone = resolveAdminAvailabilityTimeZone(timeZone, viewerTimeZone)
  const isTwentyFourSeven = !hasStoredScheduleTimes(availability)
  // Recurring weekly template is rendered by the calendar for whichever week is
  // displayed. Only one-off blocks are absolute-date events here.
  const blockedEvents = useMemo<CalendarEvent[]>(
    () => buildBlockedCalendarEvents(blockedDates, blockedRanges, resolvedTimeZone, viewerTimeZone),
    [blockedDates, blockedRanges, resolvedTimeZone, viewerTimeZone],
  )
  const calendarEvents = useMemo<CalendarEvent[]>(
    () => [...blockedEvents, ...supportMeetingEvents],
    [blockedEvents, supportMeetingEvents],
  )

  useEffect(() => {
    if (user?.role !== 'admin' || !user._id || supportAccess === 'none') {
      setSupportMeetingEvents([])
      setSupportEventsError(null)
      return
    }
    const controller = new AbortController()
    const load = async () => {
      // Canonical admin support-calendar feed from the availability endpoint.
      // It includes pending and confirmed meetings (and legacy rows) and never
      // exposes notes. Only this admin's assigned meetings belong on this view.
      setSupportEventsError(null)
      const range = supportDateWindow(resolvedTimeZone, 31)
      const result = await adminListSupportAvailability({
        from: range.from,
        to: range.to,
        timeZone: resolvedTimeZone,
        signal: controller.signal,
      })
      const events: CalendarEvent[] = []
      for (const event of supportCalendarDisplayEvents(result.events, {
        assignedAdminId: user._id,
      })) {
        const start = new Date(event.start)
        const end = new Date(event.end)
        events.push({
          id: `support-meeting-${event.id}`,
          type: 'support',
          title: event.pending ? 'Support meeting (pending)' : 'Support meeting',
          start,
          end,
          meta: { ticketNumber: event.ticketNumber || undefined, note: event.subject },
          readOnly: true,
        })
      }
      if (!controller.signal.aborted) setSupportMeetingEvents(events)
    }
    void load().catch((error: unknown) => {
      if (controller.signal.aborted) return
      // Do not silently hide busy support time: state that the feed failed and
      // offer a retry next to the calendar.
      setSupportMeetingEvents([])
      setSupportEventsError(getErrorMessage(error, ''))
    })
    return () => controller.abort()
  }, [user?.role, user?._id, resolvedTimeZone, supportEventsReloadKey, supportAccess])

  useEffect(() => {
    void fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/admin/availability`, { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.msg || 'Failed to load availability')
        setLoadError(false)
        const loadedTimeZone = json.data?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        const normalizedTimeZone = resolveAdminAvailabilityTimeZone(loadedTimeZone, viewerTimeZone)
        setAvailability(mergeLoadedAvailability(json.data?.availability))
        setBlockedDates((json.data?.blockedDates || []).map((item: BlockedDate) => ({ date: item.date ? safeFormatInTimeZone(new Date(item.date), normalizedTimeZone, 'yyyy-MM-dd', viewerTimeZone) : '', reason: item.reason || '' })).filter((item: BlockedDate) => item.date))
        setBlockedRanges((json.data?.blockedRanges || []).map((range: BlockedRange) => ({ startDate: range.startDate ? safeFormatInTimeZone(new Date(range.startDate), normalizedTimeZone, "yyyy-MM-dd'T'HH:mm", viewerTimeZone) : '', endDate: range.endDate ? safeFormatInTimeZone(new Date(range.endDate), normalizedTimeZone, "yyyy-MM-dd'T'HH:mm", viewerTimeZone) : '', reason: range.reason || '' })).filter((range: BlockedRange) => range.startDate && range.endDate))
        setTimeZone(normalizedTimeZone)
      })
      .catch((error: unknown) => { setLoadError(true); toast.error(getErrorMessage(error, 'Failed to load availability')) })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (loadError || loading) return
    const payload = mergeLoadedAvailability(availability)
    for (const { key, label } of DAYS) {
      const day = payload[key]
      if (day.available && (!day.startTime || !day.endTime || day.endTime <= day.startTime)) {
        toast.error(`${label} end time must be after start time`)
        return
      }
    }
    setSaving(true)
    try {
      const normalizedTimeZone = resolveAdminAvailabilityTimeZone(timeZone, viewerTimeZone)
      const blockedDatesUtc = blockedDates
        .filter((item) => item.date)
        .map((item) => ({
          ...item,
          date: fromZonedTime(`${item.date}T00:00:00`, normalizedTimeZone).toISOString(),
        }))
      const blockedRangesUtc = blockedRanges
        .filter((range) => range.startDate && range.endDate)
        .map((range) => {
          const start = fromZonedTime(range.startDate, normalizedTimeZone)
          const end = fromZonedTime(range.endDate, normalizedTimeZone)
          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
            throw new Error('Blocked slots need a valid start and end')
          }
          return {
            ...range,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          }
        })
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/admin/availability`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availability: payload,
          blockedDates: blockedDatesUtc,
          blockedRanges: blockedRangesUtc,
          timeZone: resolveAdminAvailabilityTimeZone(timeZone, viewerTimeZone),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.msg || 'Failed to save availability')
      await checkAuth()
      toast.success('Availability saved')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to save availability'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Card><CardContent className="flex items-center gap-2 pt-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading availability…</CardContent></Card>

  return <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />Admin availability</CardTitle><CardDescription>Set the hours when colleagues can book support meetings with you. The schedule is interpreted in your selected timezone.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:max-w-md"><Label htmlFor="admin-time-zone">Timezone</Label><Input id="admin-time-zone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} placeholder="Europe/Brussels" /><p className="text-xs text-slate-500">Your browser timezone is {viewerTimeZone}. Use an IANA timezone such as Europe/Brussels or America/New_York.</p></div>
        <WeeklyAvailabilityCalendar
          title="Weekly availability calendar"
          description={isTwentyFourSeven ? 'No weekly schedule is configured, so this admin is available 24/7.' : `Displayed in ${resolvedTimeZone}. Use the arrows to check any week — the schedule repeats weekly.`}
          events={calendarEvents}
          weeklySchedule={availability}
          weeklyScheduleTimeZone={resolvedTimeZone}
          dayStart="00:00"
          dayEnd="23:59"
          visibleDays={[0, 1, 2, 3, 4, 5, 6]}
          timeZone={resolvedTimeZone}
        />
        {supportEventsError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          >
            <span>
              {supportCalendarWarning(
                'Support meetings could not be loaded, so this calendar may be incomplete.',
                supportEventsError,
              )}
            </span>
            <button
              type="button"
              onClick={() => setSupportEventsReloadKey((value) => value + 1)}
              className="rounded-md border border-amber-300 bg-white px-2 py-1 font-medium"
            >
              Retry
            </button>
          </div>
        ) : null}
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const day = availability[key]
            return (
              <div key={key} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[130px_110px_1fr_1fr] sm:items-center">
                <span className="font-medium">{label}</span>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={day.available}
                    onCheckedChange={(checked) => setAvailability((current) => ({
                      ...current,
                      [key]: mergeAdminDaySchedule(key, { ...current[key], available: checked === true }),
                    }))}
                  />
                  Available
                </label>
                <div className="grid gap-1">
                  <Label htmlFor={`admin-${key}-start`} className="text-xs text-slate-500">Start</Label>
                  <Input
                    id={`admin-${key}-start`}
                    type="time"
                    step={60}
                    value={parseClockTime(day.startTime) || '09:00'}
                    disabled={!day.available}
                    onChange={(event) => setAvailability((current) => ({
                      ...current,
                      [key]: { ...current[key], startTime: parseClockTime(event.target.value) || event.target.value },
                    }))}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`admin-${key}-end`} className="text-xs text-slate-500">End</Label>
                  <Input
                    id={`admin-${key}-end`}
                    type="time"
                    step={60}
                    value={parseClockTime(day.endTime) || '17:00'}
                    disabled={!day.available}
                    onChange={(event) => setAvailability((current) => ({
                      ...current,
                      [key]: { ...current[key], endTime: parseClockTime(event.target.value) || event.target.value },
                    }))}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Blocked dates</CardTitle><CardDescription>Block a full day without changing your weekly schedule.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {blockedDates.map((item, index) => <div key={`${item.date}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"><span>{item.date}</span><span className="text-slate-500">{item.reason || 'Blocked'}</span><Button type="button" variant="ghost" size="sm" onClick={() => setBlockedDates((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4 text-rose-500" /></Button></div>)}
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><div><Label htmlFor="admin-block-date">Date</Label><Input id="admin-block-date" type="date" value={newDate.date} onChange={(event) => setNewDate((current) => ({ ...current, date: event.target.value }))} /></div><div><Label htmlFor="admin-block-date-reason">Reason</Label><Input id="admin-block-date-reason" value={newDate.reason || ''} onChange={(event) => setNewDate((current) => ({ ...current, reason: event.target.value }))} placeholder="Holiday" /></div><Button type="button" variant="outline" onClick={() => { if (!newDate.date) { toast.error('Choose a date to block'); return } if (blockedDates.some((item) => item.date === newDate.date)) { toast.error('That date is already blocked'); return } setBlockedDates((current) => [...current, newDate]); setNewDate({ date: '', reason: '' }) }}><Plus className="mr-1.5 h-4 w-4" />Add</Button></div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Blocked slots</CardTitle><CardDescription>Block holidays, leave, or one-off periods without changing your weekly hours.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {blockedRanges.map((range, index) => <div key={`${range.startDate}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"><span>{range.startDate || '—'} → {range.endDate || '—'}</span><span className="text-slate-500">{range.reason || 'Blocked'}</span><Button type="button" variant="ghost" size="sm" onClick={() => setBlockedRanges((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4 text-rose-500" /></Button></div>)}
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"><div><Label htmlFor="admin-block-start">Start</Label><Input id="admin-block-start" type="datetime-local" value={newRange.startDate} onChange={(event) => setNewRange((current) => ({ ...current, startDate: event.target.value }))} /></div><div><Label htmlFor="admin-block-end">End</Label><Input id="admin-block-end" type="datetime-local" value={newRange.endDate} onChange={(event) => setNewRange((current) => ({ ...current, endDate: event.target.value }))} /></div><div><Label htmlFor="admin-block-reason">Reason</Label><Input id="admin-block-reason" value={newRange.reason || ''} onChange={(event) => setNewRange((current) => ({ ...current, reason: event.target.value }))} placeholder="Leave" /></div><Button type="button" variant="outline" onClick={() => { if (!newRange.startDate || !newRange.endDate || newRange.endDate < newRange.startDate) { toast.error('Enter a valid blocked period'); return } setBlockedRanges((current) => [...current, newRange]); setNewRange({ startDate: '', endDate: '', reason: '' }) }}><Plus className="mr-1.5 h-4 w-4" />Add</Button></div>
        {loadError ? <p className="text-sm text-rose-600">Availability could not be loaded. Refresh the page before saving.</p> : null}
        <Button onClick={() => void save()} disabled={saving || loading || loadError}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{saving ? 'Saving…' : 'Save availability'}</Button>
      </CardContent>
    </Card>
  </div>
}
