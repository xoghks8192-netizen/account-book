import test from 'node:test'
import assert from 'node:assert/strict'
import { todayKst, currentMonth, monthRange } from '../src/lib/dates.js'
import resetPassword from '../api/reset-password.js'
import rates from '../api/savings-rates.js'
import realestate from '../api/realestate.js'
import realestateAi from '../api/realestate-ai.js'

test('Korean midnight is the next calendar day before UTC midnight', () => {
  assert.equal(todayKst(new Date('2026-09-30T15:00:00Z')), '2026-10-01')
  assert.equal(todayKst(new Date('2026-09-30T14:59:59Z')), '2026-09-30')
  assert.deepEqual(currentMonth(new Date('2026-12-31T15:00:00Z')), { year: 2027, month: 0 })
})

test('month boundaries preserve first and last days, including leap years', () => {
  assert.deepEqual(monthRange(2026, 9), { start: '2026-10-01', end: '2026-11-01' })
  assert.deepEqual(monthRange(2026, -1), { start: '2025-12-01', end: '2026-01-01' })
  assert.deepEqual(monthRange(2026, 12), { start: '2027-01-01', end: '2027-02-01' })
  const range = monthRange(2024, 1)
  assert.ok('2024-02-29' >= range.start && '2024-02-29' < range.end)
  assert.ok(!('2024-03-01' < range.end))
})

for (const [name, handler] of Object.entries({ resetPassword, rates, realestate, realestateAi })) {
  test(`${name} is disabled server-side for every method`, async () => {
    for (const method of ['GET', 'POST', 'DELETE']) {
      let status, body
      await handler({ method }, {
        status(value) { status = value; return this },
        json(value) { body = value; return this },
      })
      assert.equal(status, 410)
      assert.equal(body.error, '사용이 종료된 기능입니다.')
    }
  })
}
