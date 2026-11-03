import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { test } from 'node:test'

register('./swc-loader.mjs', import.meta.url)

const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const { NextIntlClientProvider } = await import('next-intl')
const { default: RescheduleRequestCard } = await import('@/components/booking/RescheduleRequestCard')
const { hasRecordedRescheduleRequest, legacyRescheduleEntries } = await import('@/lib/bookingDetails.ts')

const messages = {
  bookings: JSON.parse(readFileSync(new URL('../messages/en/bookings.json', import.meta.url), 'utf8')),
  common: JSON.parse(readFileSync(new URL('../messages/en/common.json', import.meta.url), 'utf8')),
}

/**
 * Exactly what the backend booking GET serializes for a booking that never had
 * a reschedule request: Mongoose (8.24.1, fixera-server models/booking.ts
 * nested `rescheduleRequest` path) materializes the `assignedTeamMembers`
 * arrays as [] on hydrate/`new Booking()`, and `toObject()` keeps them.
 */
const MONGOOSE_DEFAULT_SHELL = {
  previousSchedule: { assignedTeamMembers: [] },
  proposedSchedule: { assignedTeamMembers: [] },
}

const CUSTOMER = 'customer-1'
const PROFESSIONAL = 'pro-1'

function renderCard(reschedules, viewer = { id: CUSTOMER, role: 'customer' }) {
  return renderToStaticMarkup(
    React.createElement(
      NextIntlClientProvider,
      { locale: 'en', messages, timeZone: 'UTC', onError() {} },
      React.createElement(RescheduleRequestCard, {
        bookingId: 'b1',
        reschedules,
        viewerUserId: viewer.id,
        viewerRole: viewer.role,
        hourMode: true,
      })
    )
  )
}

test('the schema-default rescheduleRequest shell renders no reschedule panel (sparse / completion-ready bookings)', () => {
  for (const shell of [
    MONGOOSE_DEFAULT_SHELL,
    {},
    { previousSchedule: {}, proposedSchedule: {} },
    { reason: '   ', previousSchedule: { assignedTeamMembers: [], scheduledStartDate: null } },
    null,
    undefined,
  ]) {
    assert.equal(hasRecordedRescheduleRequest(shell), false, JSON.stringify(shell))
    const entries = legacyRescheduleEntries(shell, CUSTOMER)
    assert.deepEqual(entries, [])
    assert.equal(renderCard(entries), '', `no panel for ${JSON.stringify(shell)}`)
  }
})

test('a recorded pending request from the other party still renders with its reason, schedules and actions', () => {
  const request = {
    ...MONGOOSE_DEFAULT_SHELL,
    status: 'pending',
    requestedBy: PROFESSIONAL,
    requestedAt: '2026-10-20T09:00:00.000Z',
    reason: 'Material delivery delayed',
    description: 'Supplier moved the delivery by a week.',
    previousSchedule: { scheduledStartDate: '2026-10-23T00:00:00.000Z', scheduledStartTime: '09:00', assignedTeamMembers: [] },
    proposedSchedule: { scheduledStartDate: '2026-10-30T00:00:00.000Z', scheduledStartTime: '10:00', assignedTeamMembers: [] },
  }
  const entries = legacyRescheduleEntries(request, CUSTOMER)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].canRespond, true)
  assert.equal(entries[0].status, 'pending')
  const html = renderCard(entries)
  assert.match(html, /Material delivery delayed/)
  assert.match(html, /Supplier moved the delivery by a week\./)
  assert.match(html, /09:00 23\/10\/2026/, "original schedule")
  assert.match(html, /10:00 30\/10\/2026/, "new schedule")
  assert.match(html, new RegExp(messages.bookings.common.accept))
  assert.doesNotMatch(html, new RegExp(messages.bookings.rescheduleRequest.noActionAvailable))
})

test('the requester (string or populated id) cannot answer their own pending request', () => {
  const base = { status: 'pending', requestedAt: '2026-10-20T09:00:00.000Z', reason: 'Sick team member', proposedSchedule: { scheduledStartDate: '2026-10-30T00:00:00.000Z' } }
  for (const requestedBy of [CUSTOMER, { _id: CUSTOMER, name: 'Customer' }]) {
    const entries = legacyRescheduleEntries({ ...base, requestedBy }, CUSTOMER)
    assert.equal(entries.length, 1)
    assert.equal(entries[0].canRespond, false)
    const html = renderCard(entries)
    assert.match(html, /Sick team member/)
    assert.doesNotMatch(html, new RegExp(`>${messages.bookings.common.accept}<`))
  }
})

test('recorded accepted / declined / disputed requests stay visible with their status and reason', () => {
  for (const status of ['accepted', 'declined', 'disputed']) {
    const entries = legacyRescheduleEntries(
      { ...MONGOOSE_DEFAULT_SHELL, status, reason: `Reason ${status}`, requestedAt: '2026-10-20T09:00:00.000Z' },
      CUSTOMER
    )
    assert.equal(entries.length, 1, status)
    assert.equal(entries[0].status, status)
    assert.equal(entries[0].canRespond, false)
    const html = renderCard(entries)
    assert.match(html, new RegExp(`Reason ${status}`))
    assert.match(html, new RegExp(messages.bookings.rescheduleRequest.status[status]))
  }
  // Even a partially recorded legacy request (e.g. only a proposed date) is real.
  assert.equal(legacyRescheduleEntries({ proposedSchedule: { scheduledStartDate: '2026-10-30T00:00:00.000Z', assignedTeamMembers: [] } }, CUSTOMER).length, 1)
  assert.equal(legacyRescheduleEntries({ requestedBy: PROFESSIONAL }, CUSTOMER).length, 1)
})
