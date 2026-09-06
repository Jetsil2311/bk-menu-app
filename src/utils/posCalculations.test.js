import { describe, expect, it } from 'vitest'
import {
  createTodayKey,
  getItemLineTotal,
  getOrderTotal,
  normalizeSearchText,
} from './posCalculations'

describe('POS calculations', () => {
  it('includes options, toppings, and quantity in an item total', () => {
    expect(getItemLineTotal({
      price: 50,
      qty: 2,
      selectedOptions: [{ priceModifier: 5 }],
      selectedToppings: [{ price: 7.5 }],
    })).toBe(125)
  })

  it('sums item totals without mutating the source list', () => {
    const items = [{ price: 30, qty: 1 }, { price: 20, qty: 3 }]
    expect(getOrderTotal(items)).toBe(90)
    expect(items).toHaveLength(2)
  })

  it('normalizes accented search text and creates local date keys', () => {
    expect(normalizeSearchText('  TÉ Chai  ')).toBe('  te chai  ')
    expect(createTodayKey(new Date(2026, 7, 5))).toBe('2026-08-05')
  })
})
