import { describe, expect, it } from 'vitest'
import {
  buildDailyTrend, buildDocIdByLegacyIdMap, buildNameToDocIdMap, computeOrderRevenue,
  enrichOrderFinancials, summarizeTrend,
} from './financeCalculations'
import { fixedCostForDay } from './expenses'
import { isPaidOrderStatus } from './orderStatus'

// Firestore Timestamp stand-in
const ts = (y, m, d, h = 12) => ({ toDate: () => new Date(y, m - 1, d, h) })

const PRODUCTS = [
  { docId: 'taro-doc', id: 7, name: 'Taro' },
  { docId: 'latte-doc', id: 9, name: 'Latte' },
  { docId: 'galleta-doc', id: 11, name: 'Galleta' }, // no recipe
]
const RECIPES = {
  'taro-doc': { fixedIngredients: [{ totalCost: 12 }] },
  'latte-doc': { fixedIngredients: [{ totalCost: 9 }], optionIngredients: { leche: { options: { avena: { ingredients: [{ totalCost: 4 }] } } } } },
}
const enrich = (o) => enrichOrderFinancials(o, RECIPES, buildDocIdByLegacyIdMap(PRODUCTS), buildNameToDocIdMap(PRODUCTS))

// Same pipeline as Finance.jsx: enrich → keep paid → per-day.
const trendFor = (orders, start, end, opts = {}) =>
  buildDailyTrend(orders.map(enrich).filter((o) => isPaidOrderStatus(o.status)), { start, end, now: new Date(2026, 9, 31), ...opts })

const OCT1 = new Date(2026, 9, 1)
const OCT3 = new Date(2026, 9, 3, 23, 59)

describe('order revenue and cost', () => {
  it('uses the cost recorded when the order was paid', () => {
    const o = enrich({
      status: 'Pagado', total: 120,
      items: [{ productDocId: 'taro-doc', name: 'Taro', price: 60, qty: 2, totalCost: 24 }],
    })
    expect(o).toMatchObject({ revenue: 120, totalCogs: 24, grossProfit: 96, uncostedRevenue: 0 })
  })

  it('estimates cost from the recipe when the line has no productDocId (old web import)', () => {
    const o = enrich({
      status: 'Pagado', total: 55,
      items: [{ id: 9, name: 'Latte', price: 45, qty: 1, selectedOptions: [{ groupId: 'leche', optionId: 'avena', optionName: 'Avena', priceModifier: 10 }] }],
    })
    expect(o).toMatchObject({ revenue: 55, totalCogs: 13, costEstimated: true, uncostedRevenue: 0 })
  })

  it('flags sales of products without a recipe instead of silently calling them pure profit', () => {
    const o = enrich({
      status: 'Pagado', total: 90,
      items: [
        { productDocId: 'taro-doc', name: 'Taro', price: 60, qty: 1, totalCost: 12 },
        { productDocId: 'galleta-doc', name: 'Galleta', price: 30, qty: 1, totalCost: null },
      ],
    })
    expect(o).toMatchObject({ revenue: 90, totalCogs: 12, grossProfit: 78, uncostedRevenue: 30 })
  })

  it('keeps the full sale value when part was paid with loyalty', () => {
    expect(computeOrderRevenue({ total: 40, paymentMethods: { cash: 40, card: 0, loyalty: 20 } })).toBe(60)
  })
})

describe('daily trend', () => {
  const ORDERS = [
    { status: 'Pagado', completedAt: ts(2026, 10, 1), items: [{ productDocId: 'taro-doc', name: 'Taro', price: 60, qty: 2, totalCost: 24 }] },
    { status: 'Pagado', completedAt: ts(2026, 10, 3), items: [{ productDocId: 'galleta-doc', name: 'Galleta', price: 30, qty: 1, totalCost: null }] },
    // not sales:
    { status: 'Reembolsado', completedAt: ts(2026, 10, 1), items: [{ name: 'Taro', price: 60, qty: 5 }] },
    { status: 'Cancelado', createdAt: ts(2026, 10, 2), items: [{ name: 'Taro', price: 60, qty: 5 }] },
    { status: 'Nuevo', createdAt: ts(2026, 10, 2), items: [{ name: 'Taro', price: 60, qty: 5 }] },
    { source: 'whatsapp', createdAt: ts(2026, 10, 2), total: 300, content: '1. 5 x Taro - $300.00' },
  ]

  it('has one row per day, including days without sales', () => {
    const days = trendFor(ORDERS, OCT1, OCT3)
    expect(days.map((d) => [d.key, d.revenue, d.orderCount])).toEqual([
      ['2026-10-01', 120, 1],
      ['2026-10-02', 0, 0],
      ['2026-10-03', 30, 1],
    ])
  })

  it('subtracts ingredients and fixed costs to get what the café kept', () => {
    const days = trendFor(ORDERS, OCT1, OCT3, { fixedCostForDay: () => 50 })
    expect(days[0]).toMatchObject({ revenue: 120, cogs: 24, grossProfit: 96, fixedCosts: 50, netProfit: 46 })
    expect(days[1]).toMatchObject({ revenue: 0, netProfit: -50 })
    expect(summarizeTrend(days)).toMatchObject({
      revenue: 150, cogs: 24, grossProfit: 126, fixedCosts: 150, netProfit: -24,
      uncostedRevenue: 30, orderCount: 2, daysWithSales: 2,
    })
  })

  it('does not draw days after today', () => {
    const days = buildDailyTrend([], { start: OCT1, end: new Date(2026, 9, 31), now: new Date(2026, 9, 3, 9) })
    expect(days).toHaveLength(3)
  })
})

describe('fixed costs per day', () => {
  const EXPENSES = [
    { name: 'Renta', amount: 3100, period: 'monthly' },
    { name: 'Licencia', amount: 3650, period: 'annual' },
  ]
  it('spreads monthly costs over that month and annual ones over the year', () => {
    expect(fixedCostForDay(EXPENSES, new Date(2026, 9, 5))).toBeCloseTo(100 + 10, 5) // October: 31 days
    expect(fixedCostForDay(EXPENSES, new Date(2026, 1, 5))).toBeCloseTo(3100 / 28 + 10, 5)
  })
})
