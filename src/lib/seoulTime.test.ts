import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fitDayFontSize } from './dateIconLayout.ts'
import {
  msUntilNextSeoulMidnight,
  seoulDateKey,
  seoulDayOfMonth,
  SEOUL_TIME_ZONE,
} from './seoulTime.ts'

describe('seoulTime', () => {
  it('exports Asia/Seoul once', () => {
    assert.equal(SEOUL_TIME_ZONE, 'Asia/Seoul')
  })

  it('uses Seoul day when UTC is previous calendar day', () => {
    // 2024-01-01 00:30 KST = 2023-12-31 15:30 UTC
    const utcPrev = new Date('2023-12-31T15:30:00.000Z')
    assert.equal(seoulDateKey(utcPrev), '2024-01-01')
    assert.equal(seoulDayOfMonth(utcPrev), 1)
  })

  it('uses Seoul day when UTC is next calendar day', () => {
    const still15 = new Date('2024-06-15T14:30:00.000Z')
    assert.equal(seoulDayOfMonth(still15), 15)
    const next16 = new Date('2024-06-15T15:30:00.000Z')
    assert.equal(seoulDayOfMonth(next16), 16)
  })

  it('rolls month-end to next month day 1 in Seoul', () => {
    const endOfJan = new Date('2024-01-31T14:59:30.000Z')
    assert.equal(seoulDayOfMonth(endOfJan), 31)
    assert.equal(seoulDateKey(endOfJan), '2024-01-31')

    const feb1 = new Date('2024-01-31T15:00:30.000Z')
    assert.equal(seoulDayOfMonth(feb1), 1)
    assert.equal(seoulDateKey(feb1), '2024-02-01')
  })

  it('msUntilNextSeoulMidnight lands on next Seoul date', () => {
    const now = new Date('2024-08-08T10:00:00.000Z')
    const ms = msUntilNextSeoulMidnight(now)
    const next = new Date(now.getTime() + ms)
    assert.equal(seoulDateKey(now), '2024-08-08')
    assert.equal(seoulDateKey(next), '2024-08-09')
    assert.ok(ms > 0)
    assert.ok(ms < 24 * 60 * 60 * 1000)
  })

  it('msUntilNextSeoulMidnight near Seoul midnight', () => {
    const near = new Date('2024-08-08T14:59:50.000Z')
    const ms = msUntilNextSeoulMidnight(near)
    assert.ok(ms < 15_000)
    const next = new Date(near.getTime() + ms)
    assert.equal(seoulDateKey(next), '2024-08-09')
  })
})

describe('fitDayFontSize', () => {
  it('fits 1, 8, 10, 28, 31 with measured width', () => {
    const measure = (fs: number, text: string) => fs * 0.62 * text.length
    const maxW = 200
    const maxH = 220
    for (const day of [1, 8, 10, 28, 31]) {
      const text = String(day)
      const fs = fitDayFontSize(text, maxW, maxH, measure)
      assert.ok(fs >= 8)
      assert.ok(measure(fs, text) <= maxW + 0.01)
      assert.ok(fs <= maxH + 0.01)
    }
    const fs1 = fitDayFontSize('1', maxW, maxH, measure)
    const fs28 = fitDayFontSize('28', maxW, maxH, measure)
    assert.ok(fs28 < fs1)
  })
})
