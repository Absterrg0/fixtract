'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { CalendarDays, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import WeeklyAvailabilityCalendar, { type CalendarEvent } from '@/components/calendar/WeeklyAvailabilityCalendar'

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
  DAYS.map(({ key }) => [key, { available: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(key), startTime: '09:00', endTime: '17:00' }]),
) as Record<DayKey, DaySchedule>

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export default function AdminAvailability() {
  const { checkAuth } = useAuth()
  const [availability, setAvailability] = useState(defaultAvailability)
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([])
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [newDate, setNewDate] = useState<BlockedDate>({ date: '', reason: '' })
  const [newRange, setNewRange] = useState<BlockedRange>({ startDate: '', endDate: '', reason: '' })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const viewerTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])
  const hasConfiguredSchedule = useMemo(
    () => Object.values(availability).some((day) => day.available && day.startTime && day.endTime),
    [availability],
  )
  const scheduleEvents = useMemo<CalendarEvent[]>(() => {
    const today = new Date()
    const todayValue = formatInTimeZone(today, timeZone, 'yyyy-MM-dd')
    const todayKey = formatInTimeZone(today, timeZone, 'EEEE').toLowerCase() as DayKey
    const todayIndex = DAYS.findIndex(({ key }) => key === todayKey)
    const mondayValue = addIsoDays(todayValue, -Math.max(todayIndex, 0))

    return DAYS.flatMap(({ key }, index) => {
      const day = availability[key]
      const date = addIsoDays(mondayValue, index)
      const startTime = hasConfiguredSchedule ? day.startTime : '00:00'
      const endTime = hasConfiguredSchedule ? day.endTime : '23:59'
      if (hasConfiguredSchedule && (!day.available || !startTime || !endTime)) return []

      return [{
        id: `admin-availability-${key}`,
        type: 'personal' as const,
        title: hasConfiguredSchedule ? 'Available' : '24/7',
        start: fromZonedTime(`${date}T${startTime}:00`, timeZone),
        end: fromZonedTime(`${date}T${endTime}:00`, timeZone),
        readOnly: true,
      }]
    })
  }, [availability, hasConfiguredSchedule, timeZone])

  useEffect(() => {
    void fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/admin/availability`, { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.msg || 'Failed to load availability')
        setLoadError(false)
        const loadedTimeZone = json.data?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        setAvailability({ ...defaultAvailability(), ...(json.data?.availability || {}) })
        setBlockedDates((json.data?.blockedDates || []).map((item: BlockedDate) => ({ date: item.date ? formatInTimeZone(new Date(item.date), loadedTimeZone, 'yyyy-MM-dd') : '', reason: item.reason || '' })).filter((item: BlockedDate) => item.date))
        setBlockedRanges((json.data?.blockedRanges || []).map((range: BlockedRange) => ({ startDate: range.startDate ? formatInTimeZone(new Date(range.startDate), loadedTimeZone, "yyyy-MM-dd'T'HH:mm") : '', endDate: range.endDate ? formatInTimeZone(new Date(range.endDate), loadedTimeZone, "yyyy-MM-dd'T'HH:mm") : '', reason: range.reason || '' })))
        setTimeZone(loadedTimeZone)
      })
      .catch((error: unknown) => { setLoadError(true); toast.error(error instanceof Error ? error.message : 'Failed to load availability') })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (loadError || loading) return
    setSaving(true)
    try {
      const blockedDatesUtc = blockedDates.map((item) => ({
        ...item,
        date: fromZonedTime(`${item.date}T00:00:00`, timeZone).toISOString(),
      }))
      const blockedRangesUtc = blockedRanges.map((range) => ({
        ...range,
        startDate: fromZonedTime(range.startDate, timeZone).toISOString(),
        endDate: fromZonedTime(range.endDate, timeZone).toISOString(),
      }))
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/admin/availability`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability, blockedDates: blockedDatesUtc, blockedRanges: blockedRangesUtc, timeZone }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.msg || 'Failed to save availability')
      await checkAuth()
      toast.success('Availability saved')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save availability')
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
          description={hasConfiguredSchedule ? `Displayed in ${timeZone}.` : 'No weekly schedule is configured, so this admin is available 24/7.'}
          events={scheduleEvents}
          dayStart="00:00"
          dayEnd="23:59"
          visibleDays={[0, 1, 2, 3, 4, 5, 6]}
          timeZone={timeZone}
        />
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => { const day = availability[key]; return <div key={key} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[130px_110px_1fr_1fr] sm:items-center"><span className="font-medium">{label}</span><label className="flex items-center gap-2 text-sm"><Checkbox checked={day.available} onCheckedChange={(checked) => setAvailability((current) => ({ ...current, [key]: { ...current[key], available: checked === true } }))} />Available</label><div className="grid gap-1"><Label htmlFor={`admin-${key}-start`} className="text-xs text-slate-500">Start</Label><Input id={`admin-${key}-start`} type="time" value={day.startTime || '09:00'} disabled={!day.available} onChange={(event) => setAvailability((current) => ({ ...current, [key]: { ...current[key], startTime: event.target.value } }))} /></div><div className="grid gap-1"><Label htmlFor={`admin-${key}-end`} className="text-xs text-slate-500">End</Label><Input id={`admin-${key}-end`} type="time" value={day.endTime || '17:00'} disabled={!day.available} onChange={(event) => setAvailability((current) => ({ ...current, [key]: { ...current[key], endTime: event.target.value } }))} /></div></div> })}
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
