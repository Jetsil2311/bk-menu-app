import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeTotals, daysUntilDue, fixedCostForDay, getNextDueDate } from './expenses'

describe('weekly expenses', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 26, 10)) // lunes 26 oct 2026
  })
  afterEach(() => vi.useRealTimers())

  const sueldos = { name: 'Sueldos', amount: 1400, period: 'weekly', dueWeekday: 5 } // viernes

  it('is spread over 7 days, ~4.33 times a month and 52 times a year', () => {
    expect(fixedCostForDay([sueldos], new Date(2026, 9, 5))).toBe(200)
    const t = computeTotals([sueldos, { name: 'Renta', amount: 6000, period: 'monthly', dueDay: 1 }])
    expect(t.weeklyTotal).toBeCloseTo(1400 + 6000 * 12 / 52, 5)
    expect(t.monthlyTotal).toBeCloseTo(1400 * 52 / 12 + 6000, 5)
    expect(t.annualTotal).toBe(1400 * 52 + 6000 * 12)
    expect(t.dailyFixedCosts).toBeCloseTo(200 + 6000 / 31, 5)
  })

  it('is due on its next weekday (today counts)', () => {
    expect(getNextDueDate(sueldos)).toEqual(new Date(2026, 9, 30))
    expect(daysUntilDue(sueldos)).toBe(4)
    expect(daysUntilDue({ ...sueldos, dueWeekday: 1 })).toBe(0)
    expect(daysUntilDue({ ...sueldos, dueWeekday: 0 })).toBe(6)
  })
})
