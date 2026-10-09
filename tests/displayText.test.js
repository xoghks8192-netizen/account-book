import test from 'node:test'
import assert from 'node:assert/strict'
import { joinDetails, koreanWon, formatLedgerDate } from '../src/lib/displayText.js'

test('ledger dates include Korean weekday without timezone drift', () => {
  assert.equal(formatLedgerDate('2026-10-09'), '10월 9일 (금)')
  assert.equal(formatLedgerDate('2026-10-09', true), '2026년 10월 9일 (금)')
  assert.equal(formatLedgerDate('2024-02-29'), '2월 29일 (목)')
  for (const value of ['', null, '2026-02-30', '2026-13-01']) assert.equal(formatLedgerDate(value), '')
})

test('detail separators omit empty and whitespace-only fields', () => {
  assert.equal(joinDetails('', null, '  ', undefined), '')
  assert.equal(joinDetails('가람', '', '메모'), '가람 · 메모')
  assert.equal(joinDetails(null, '메모'), '메모')
})
test('Korean money hint handles grouping and invalid amounts without rounding', () => {
  assert.equal(koreanWon('1,250,000'), '125만 원')
  assert.equal(koreanWon('100010001'), '1억 1만 1 원')
  assert.equal(koreanWon('0'), '0원')
  for (const value of ['',null,undefined,'-1','1.5','oops','9007199254740992']) assert.equal(koreanWon(value),'')
})
