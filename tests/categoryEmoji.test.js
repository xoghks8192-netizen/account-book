import test from 'node:test'
import assert from 'node:assert/strict'
import { getCategoryEmoji } from '../src/categories.js'

test('custom category icons prefer specific purpose over generic savings', () => {
  for (const [name, icon] of [['적금(주택청약)', '🏠'], ['적금(연금저축)', '🌱'], ['적금(ISA계좌)', '📈'], ['여행경비', '🧳'], ['커피값', '☕'], ['배우자 이체', '🔄'], ['자동차 주유', '⛽']]) assert.equal(getCategoryEmoji(name), icon)
  assert.equal(getCategoryEmoji('알수없는항목'), '🏷️')
  assert.equal(getCategoryEmoji(null), '🏷️')
})
