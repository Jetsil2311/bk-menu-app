import { describe, expect, it } from 'vitest'
import {
  buildInventory, buildLedger, buildProducts, buildSummary, expenseOccurrences,
  orderResource, paidOrdersInRange, parseRange, registerResource,
} from './finance'
import { generateApiKey, hashApiKey, looksLikeApiKey } from '../../src/utils/apiKeys'

const ts = (y, m, d, h = 12) => ({ toDate: () => new Date(y, m - 1, d, h) })
const NOW = new Date(2026, 9, 26, 20)
const RANGE = parseRange({ from: '2026-10-01', to: '2026-10-07' }, NOW)

const CATALOG = {
  products: [{ docId: 'taro', id: 7, name: 'Taro' }, { docId: 'cake', id: 9, name: 'Cake' }],
  recipes: [{ id: 'taro', fixedIngredients: [{ totalCost: 12 }] }],
}
const ORDERS = [
  { id: 'o1', orderId: 'POS-1', status: 'Pagado', completedAt: ts(2026, 10, 1, 10), customerName: 'Ana', customer: { phone: '555' },
    paymentMethods: { cash: 200, card: 0, loyalty: 0 },
    items: [{ productDocId: 'taro', name: 'Taro', price: 60, qty: 2, totalCost: 24 }] },
  { id: 'o2', orderId: 'WEB-2', source: 'whatsapp', status: 'Pagado', completedAt: ts(2026, 10, 1, 18),
    paymentMethods: { cash: 0, card: 40, loyalty: 0 },
    items: [{ id: 9, name: 'Cake', price: 40, qty: 1 }] },
  { id: 'o3', status: 'Pagado', completedAt: ts(2026, 10, 3), paymentMethods: { cash: 60, card: 0, loyalty: 20 },
    items: [{ productDocId: 'taro', name: 'Taro', price: 60, qty: 1, selectedToppings: [{ name: 'Tapioca', price: 20 }], totalCost: 12 }] },
  { id: 'x1', status: 'Reembolsado', completedAt: ts(2026, 10, 2), items: [{ name: 'Taro', price: 60, qty: 9 }] },
  { id: 'x2', status: 'Pagado', completedAt: ts(2026, 9, 30), items: [{ name: 'Taro', price: 60, qty: 9 }] }, // before range
]
const PAID = paidOrdersInRange(ORDERS, CATALOG, RANGE)

describe('range', () => {
  it('defaults to this month so far and validates input', () => {
    const r = parseRange({}, NOW)
    expect([r.start.getDate(), r.end.getDate()]).toEqual([1, 26])
    expect(parseRange({ from: '2026/10/01' }).error).toBeTruthy()
    expect(parseRange({ from: '2026-10-05', to: '2026-10-01' }).error).toBeTruthy()
    expect(parseRange({ from: '2024-01-01', to: '2026-01-01' }).error).toBeTruthy()
  })
})

describe('ledger', () => {
  const ledger = buildLedger({
    paidOrders: PAID,
    purchases: [{ id: 'p1', materialId: 'milk', quantityChanged: 12, totalCost: 312, supplier: 'Lala', purchaseDate: ts(2026, 10, 2) },
      { id: 'p0', materialId: 'milk', quantityChanged: 1, totalCost: 26, purchaseDate: ts(2026, 9, 1) }],
    materials: [{ id: 'milk', name: 'Leche entera', unit: 'liter' }],
    expenses: [{ id: 'renta', name: 'Renta', amount: 6000, period: 'monthly', dueDay: 1 },
      { id: 'sueldo', name: 'Sueldos', amount: 1400, period: 'weekly', dueWeekday: 5 }],
    range: RANGE,
  })

  it('has one income per day of sales with its payment split', () => {
    const sales = ledger.filter((e) => e.type === 'income')
    expect(sales.map((e) => [e.id, e.amount])).toEqual([['sales-2026-10-03', '80.00'], ['sales-2026-10-01', '160.00']])
    expect(sales[1].details).toMatchObject({ orders: 2, paidWith: { cash: '120.00', card: '40.00', rewards: '0.00' }, ingredientCost: '24.00' })
    expect(sales[0].details.paidWith).toEqual({ cash: '60.00', card: '0.00', rewards: '20.00' })
  })

  it('has purchases in range and fixed expenses on their due dates', () => {
    expect(ledger.find((e) => e.id === 'purchase-p1')).toMatchObject({ type: 'expense', amount: '312.00', merchant: 'Lala', category: { key: 'ingredients' } })
    expect(ledger.find((e) => e.id === 'purchase-p0')).toBeUndefined()
    const fixed = ledger.filter((e) => e.category.key === 'fixed_expenses').map((e) => e.id)
    expect(fixed).toEqual(['fixed-sueldo-2026-10-02', 'fixed-renta-2026-10-01']) // Oct 2 2026 is a Friday
  })

  it('never includes customer data', () => {
    expect(JSON.stringify(ledger)).not.toMatch(/Ana|555/)
    expect(JSON.stringify(PAID.map(orderResource))).not.toMatch(/Ana|555|customer/)
  })
})

describe('summary, products, inventory, register', () => {
  it('matches Finanzas: revenue, cost, profit, payment mix, cash flow', () => {
    const s = buildSummary({
      paidOrders: PAID,
      purchases: [{ id: 'p1', materialId: 'milk', totalCost: 312, purchaseDate: ts(2026, 10, 2) }],
      materials: [],
      expenses: [{ id: 'renta', amount: 3100, period: 'monthly', dueDay: 1 }],
      range: RANGE, now: NOW,
    })
    expect(s).toMatchObject({
      orders: 3, revenue: '240.00', ingredientCost: '36.00', grossProfit: '204.00',
      fixedCosts: '700.00', netProfit: '-496.00', revenueWithoutRecipe: '40.00',
      paidWith: { cash: '180.00', card: '40.00', rewards: '20.00' },
      cashFlow: { moneyIn: '240.00', ingredientPurchases: '312.00', fixedExpensesDue: '3100.00', net: '-3172.00' },
    })
  })

  it('reports per product, leaving cost empty when there is no recipe', () => {
    const p = buildProducts(PAID)
    expect(p[0]).toMatchObject({ name: 'Taro', quantitySold: 3, revenue: '200.00', ingredientCost: '36.00', marginPercent: 82, hasRecipe: true })
    expect(p[1]).toMatchObject({ productId: 'cake', name: 'Cake', ingredientCost: null, hasRecipe: false }) // resolved from legacy id 9
  })

  it('values inventory and flags low stock', () => {
    const inv = buildInventory([{ id: 'a', name: 'Leche', unit: 'liter', currentStock: 3, costPerUnit: 26, reorderLevel: 4 }])
    expect(inv).toMatchObject({ totalValue: '78.00', lowCount: 1, items: [{ status: 'low', value: '78.00' }] })
  })

  it('compares counted cash with what the register expected', () => {
    const r = registerResource({ id: '2026-10-01', openingFloat: 500, cashSales: 1200, deposits: [{ amount: 100, description: 'Cambio' }], withdrawals: [{ amount: 300 }], isClosed: true, closingCash: 1490 })
    expect(r).toMatchObject({ expectedCash: '1500.00', countedCash: '1490.00', difference: '-10.00', status: 'closed' })
  })
})

describe('fixed expense due dates', () => {
  it('clamps the 31st to short months and handles annual ones', () => {
    const feb = parseRange({ from: '2026-02-01', to: '2026-02-28' })
    expect(expenseOccurrences({ period: 'monthly', dueDay: 31 }, feb).map((d) => d.getDate())).toEqual([28])
    expect(expenseOccurrences({ period: 'annual', dueDay: 15, dueMonth: 2 }, feb).map((d) => d.getDate())).toEqual([15])
    expect(expenseOccurrences({ period: 'annual', dueDay: 15, dueMonth: 3 }, feb)).toEqual([])
  })
})

describe('api keys', () => {
  it('are random, recognisable and stored only as a hash', async () => {
    const a = generateApiKey()
    expect(looksLikeApiKey(a)).toBe(true)
    expect(a).not.toBe(generateApiKey())
    expect(await hashApiKey(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashApiKey('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(looksLikeApiKey('sk_live_123')).toBe(false)
  })
})
