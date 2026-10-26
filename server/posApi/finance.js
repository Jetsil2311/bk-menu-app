// Pure builders for the POS API (/api/v1, docs/POS_API.md). No Firestore
// here — everything takes plain documents, so it's unit-tested and gives the
// exact same numbers as the admin's Finanzas (same financeCalculations.js).
//
// Money is returned as strings with 2 decimals ("4230.00"), like Tally's own
// API, so nothing loses precision on the way.
import {
  buildDailyTrend, buildDocIdByLegacyIdMap, buildNameToDocIdMap,
  enrichOrderFinancials, itemLineTotal, localDayKey, orderDate, resolveProductDocId, summarizeTrend,
} from '../../src/utils/financeCalculations.js'
import {
  annualEquivalent, dailyEquivalent, fixedCostForDay, getNextDueDate,
  monthlyEquivalent, weeklyEquivalent,
} from '../../src/utils/expenses.js'
import { isPaidOrderStatus } from '../../src/utils/orderStatus.js'
import { isLowStock, isOutOfStock } from '../../src/utils/stockAlerts.js'

export const CURRENCY = 'MXN'
export const SOURCE = 'bk-pos'

export const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2)

const toDate = (v) => (v instanceof Date ? v : v?.toDate?.() ?? (typeof v === 'string' || typeof v === 'number' ? new Date(v) : null))
const iso = (d) => (d ? d.toISOString() : null)

// ── Date range ──────────────────────────────────────────────────────────────
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS = 366

// from/to are local café dates (YYYY-MM-DD), both inclusive. Default: this
// month up to today. Returns { start, end } as local Dates, or { error }.
export const parseRange = ({ from, to } = {}, now = new Date()) => {
  if ((from && !DAY_RE.test(from)) || (to && !DAY_RE.test(to))) {
    return { error: 'from/to must be dates like 2026-10-01' }
  }
  const start = from
    ? new Date(`${from}T00:00:00`)
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { error: 'Invalid date' }
  if (end < start) return { error: '"to" is before "from"' }
  if ((end - start) / 86400000 > MAX_DAYS) return { error: `Range can't be longer than ${MAX_DAYS} days` }
  return { start, end }
}

export const rangeInfo = ({ start, end }) => ({ from: localDayKey(start), to: localDayKey(end) })

// ── Orders → sales ──────────────────────────────────────────────────────────
// Paid orders in range, enriched exactly like Finance.jsx (revenue, cost,
// uncosted revenue). Refunded/cancelled/unpaid orders are not sales.
export const paidOrdersInRange = (orders, { recipes = [], products = [] }, { start, end }) => {
  const recipesById = Object.fromEntries(recipes.map((r) => [r.id, r]))
  const byLegacy = buildDocIdByLegacyIdMap(products)
  const byName = buildNameToDocIdMap(products)
  return orders
    .filter((o) => isPaidOrderStatus(o.status))
    .map((o) => enrichOrderFinancials(o, recipesById, byLegacy, byName))
    // Older web-menu lines carry only the product's legacy id or name
    .map((o) => ({ ...o, items: (o.items || []).map((it) => ({ ...it, productDocId: resolveProductDocId(it, byLegacy, byName) })) }))
    .filter((o) => {
      const d = orderDate(o)
      return d && d >= start && d <= end
    })
}

const paymentsOf = (order) => {
  const pm = order.paymentMethods || {}
  const card = Number(pm.card || 0)
  const loyalty = Number(pm.loyalty || 0)
  // cash = what was actually kept in cash (cash received can include change)
  const cash = Math.max(0, Number(order.revenue || 0) - card - loyalty)
  return { cash, card, loyalty }
}

// ── Fixed expenses ──────────────────────────────────────────────────────────
// Every date an expense falls due inside the range (weekly / monthly / annual).
export const expenseOccurrences = (expense, { start, end }) => {
  const dates = []
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  for (; day <= end; day.setDate(day.getDate() + 1)) {
    const d = new Date(day)
    const lastOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    const dueDay = Math.min(Math.max(1, Number(expense.dueDay) || 1), lastOfMonth)
    if (expense.period === 'weekly') {
      if (d.getDay() === (Number(expense.dueWeekday) || 0)) dates.push(d)
    } else if (expense.period === 'annual') {
      if (d.getMonth() + 1 === (Number(expense.dueMonth) || 1) && d.getDate() === dueDay) dates.push(d)
    } else if (d.getDate() === dueDay) {
      dates.push(d)
    }
  }
  return dates
}

export const expenseResource = (expense) => ({
  id: expense.id,
  name: expense.name,
  amount: money(expense.amount),
  currency: CURRENCY,
  frequency: ['weekly', 'annual'].includes(expense.period) ? expense.period : 'monthly',
  dueDay: expense.period === 'weekly' ? null : Number(expense.dueDay) || 1,
  dueWeekday: expense.period === 'weekly' ? Number(expense.dueWeekday) || 0 : null, // 0 = Sunday
  dueMonth: expense.period === 'annual' ? Number(expense.dueMonth) || 1 : null,
  nextDueDate: localDayKey(getNextDueDate(expense)),
  equivalents: {
    daily: money(dailyEquivalent(expense)),
    weekly: money(weeklyEquivalent(expense)),
    monthly: money(monthlyEquivalent(expense)),
    annual: money(annualEquivalent(expense)),
  },
})

// ── Ledger ──────────────────────────────────────────────────────────────────
// The café's money as transactions, ready to become Tally entries:
//   income  · one per day with sales (detail per payment method)
//   expense · one per ingredient purchase (Inventario → Registrar compra)
//   expense · one per fixed-expense due date (status 'scheduled': the café
//             registers when it's due, not proof that it was paid)
// Ids are stable, so importing the same range twice can be de-duplicated.
// Ingredient COST (what sales used up) is not a ledger entry — the money left
// when the ingredients were bought; it's in /summary and /daily instead.
export const buildLedger = ({ paidOrders, purchases = [], materials = [], expenses = [], range }) => {
  const entries = []

  const days = {}
  for (const o of paidOrders) {
    const key = localDayKey(orderDate(o))
    const day = (days[key] ||= { orders: 0, revenue: 0, cogs: 0, cash: 0, card: 0, loyalty: 0, at: orderDate(o) })
    const p = paymentsOf(o)
    day.orders += 1
    day.revenue += Number(o.revenue || 0)
    day.cogs += Number(o.totalCogs || 0)
    day.cash += p.cash
    day.card += p.card
    day.loyalty += p.loyalty
    if (orderDate(o) > day.at) day.at = orderDate(o)
  }
  for (const [key, d] of Object.entries(days)) {
    entries.push({
      id: `sales-${key}`,
      type: 'income',
      status: 'confirmed',
      amount: money(d.revenue),
      currency: CURRENCY,
      date: iso(d.at),
      localDate: key,
      description: `Ventas del día (${d.orders} pedido${d.orders !== 1 ? 's' : ''})`,
      category: { key: 'sales', name: 'Ventas' },
      merchant: 'Bubble Kaapeh',
      source: SOURCE,
      details: {
        orders: d.orders,
        paidWith: { cash: money(d.cash), card: money(d.card), rewards: money(d.loyalty) },
        ingredientCost: money(d.cogs),
        grossProfit: money(d.revenue - d.cogs),
      },
    })
  }

  const materialsById = Object.fromEntries(materials.map((m) => [m.id, m]))
  for (const p of purchases) {
    const at = toDate(p.purchaseDate) || toDate(p.createdAt)
    if (!at || at < range.start || at > range.end) continue
    const m = materialsById[p.materialId]
    entries.push({
      id: `purchase-${p.id}`,
      type: 'expense',
      status: 'confirmed',
      amount: money(p.totalCost),
      currency: CURRENCY,
      date: iso(at),
      localDate: localDayKey(at),
      description: `Compra de insumo: ${m?.name || 'insumo'} (${Number(p.quantityChanged) || 0} ${m?.unit || ''})`.trim(),
      category: { key: 'ingredients', name: 'Insumos' },
      merchant: p.supplier || null,
      source: SOURCE,
      details: {
        materialId: p.materialId,
        materialName: m?.name || null,
        quantity: Number(p.quantityChanged) || 0,
        unit: m?.unit || null,
        invoiceNumber: p.invoiceNumber || null,
        notes: p.notes || null,
      },
    })
  }

  for (const e of expenses) {
    for (const d of expenseOccurrences(e, range)) {
      const key = localDayKey(d)
      entries.push({
        id: `fixed-${e.id}-${key}`,
        type: 'expense',
        status: 'scheduled',
        amount: money(e.amount),
        currency: CURRENCY,
        date: iso(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)),
        localDate: key,
        description: e.name,
        category: { key: 'fixed_expenses', name: 'Gastos fijos' },
        merchant: null,
        source: SOURCE,
        details: { expenseId: e.id, frequency: e.period || 'monthly' },
      })
    }
  }

  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)))
}

// ── Summary / daily ─────────────────────────────────────────────────────────
export const buildDaily = ({ paidOrders, expenses, range, now = new Date() }) =>
  buildDailyTrend(paidOrders, {
    start: range.start, end: range.end, now,
    fixedCostForDay: (d) => fixedCostForDay(expenses, d),
  })

export const dayResource = (d) => ({
  date: d.key,
  orders: d.orderCount,
  revenue: money(d.revenue),
  ingredientCost: money(d.cogs),
  grossProfit: money(d.grossProfit),
  fixedCosts: money(d.fixedCosts),
  netProfit: money(d.netProfit),
  revenueWithoutRecipe: money(d.uncostedRevenue),
})

export const buildSummary = ({ paidOrders, purchases, expenses, materials, range, now = new Date() }) => {
  const days = buildDaily({ paidOrders, expenses, range, now })
  const t = summarizeTrend(days)
  const pay = paidOrders.reduce((acc, o) => {
    const p = paymentsOf(o)
    acc.cash += p.cash; acc.card += p.card; acc.loyalty += p.loyalty
    return acc
  }, { cash: 0, card: 0, loyalty: 0 })
  const ledger = buildLedger({ paidOrders: [], purchases, materials, expenses: [], range })
  const purchasesTotal = ledger.reduce((s, e) => s + Number(e.amount), 0)
  const scheduledFixed = expenses.reduce((s, e) => s + expenseOccurrences(e, range).length * (Number(e.amount) || 0), 0)
  return {
    ...rangeInfo(range),
    currency: CURRENCY,
    orders: t.orderCount,
    daysWithSales: t.daysWithSales,
    averageTicket: money(t.orderCount ? t.revenue / t.orderCount : 0),
    revenue: money(t.revenue),
    paidWith: { cash: money(pay.cash), card: money(pay.card), rewards: money(pay.loyalty) },
    // Profit view (accrual): what the sales cost to make + fixed costs spread per day
    ingredientCost: money(t.cogs),
    grossProfit: money(t.grossProfit),
    grossMarginPercent: t.revenue > 0 ? Number(((t.grossProfit / t.revenue) * 100).toFixed(1)) : 0,
    fixedCosts: money(t.fixedCosts),
    netProfit: money(t.netProfit),
    // Sales of products without a recipe: their cost counts as $0, so profit is overstated by up to this
    revenueWithoutRecipe: money(t.uncostedRevenue),
    // Cash-flow view: money in vs money out as it happened
    cashFlow: {
      moneyIn: money(t.revenue),
      ingredientPurchases: money(purchasesTotal),
      fixedExpensesDue: money(scheduledFixed),
      net: money(t.revenue - purchasesTotal - scheduledFixed),
    },
  }
}

// ── Products ────────────────────────────────────────────────────────────────
export const buildProducts = (paidOrders) => {
  const byKey = {}
  for (const o of paidOrders) {
    for (const it of o.items || []) {
      const key = it.productDocId || it.name
      const p = (byKey[key] ||= { productId: it.productDocId || null, name: (it.name || '').split(':')[0], quantity: 0, revenue: 0, cost: 0, uncosted: 0 })
      const line = itemLineTotal(it)
      p.quantity += Number(it.qty) || 1
      p.revenue += line
      if (it.totalCost == null) p.uncosted += line
      else p.cost += Number(it.totalCost)
    }
  }
  return Object.values(byKey)
    .map((p) => {
      const hasRecipe = p.uncosted === 0
      const profit = p.revenue - p.cost
      return {
        productId: p.productId,
        name: p.name,
        quantitySold: p.quantity,
        revenue: money(p.revenue),
        ingredientCost: hasRecipe ? money(p.cost) : null,
        grossProfit: hasRecipe ? money(profit) : null,
        marginPercent: hasRecipe && p.revenue > 0 ? Number(((profit / p.revenue) * 100).toFixed(1)) : null,
        hasRecipe,
      }
    })
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
}

// ── Orders (no customer data) ───────────────────────────────────────────────
export const orderResource = (o) => {
  const p = paymentsOf(o)
  return {
    id: o.id,
    code: o.orderId || null,
    paidAt: iso(orderDate(o)),
    channel: o.source === 'whatsapp' ? 'web_menu' : 'counter',
    total: money(o.revenue),
    ingredientCost: money(o.totalCogs),
    grossProfit: money(o.grossProfit),
    paidWith: { cash: money(p.cash), card: money(p.card), rewards: money(p.loyalty) },
    items: (o.items || []).map((it) => ({
      productId: it.productDocId || null,
      name: it.name,
      quantity: Number(it.qty) || 1,
      options: [...(it.selectedOptions || []).map((x) => x.optionName), ...(it.selectedToppings || []).map((x) => x.name)].filter(Boolean),
      total: money(itemLineTotal(it)),
      ingredientCost: it.totalCost == null ? null : money(it.totalCost),
    })),
  }
}

// ── Inventory ───────────────────────────────────────────────────────────────
export const buildInventory = (materials) => {
  const items = materials
    .map((m) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      inStock: Number(m.currentStock) || 0,
      costPerUnit: money(m.costPerUnit),
      value: money((Number(m.currentStock) || 0) * (Number(m.costPerUnit) || 0)),
      warnAt: Number(m.reorderLevel) || 0,
      status: isOutOfStock(m) ? 'out' : isLowStock(m) ? 'low' : 'ok',
      supplier: m.supplier || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    currency: CURRENCY,
    totalValue: money(items.reduce((s, i) => s + Number(i.value), 0)),
    lowCount: items.filter((i) => i.status !== 'ok').length,
    items,
  }
}

// ── Register (Caja) ─────────────────────────────────────────────────────────
export const registerResource = (s) => {
  const deposits = (s.deposits || []).reduce((t, d) => t + (Number(d.amount) || 0), 0)
  const withdrawals = (s.withdrawals || []).reduce((t, w) => t + (Number(w.amount) || 0), 0)
  const expected = (Number(s.openingFloat) || 0) + (Number(s.cashSales) || 0) + deposits - withdrawals
  const closed = Boolean(s.isClosed)
  return {
    date: s.id,
    status: closed ? 'closed' : 'open',
    openingCash: money(s.openingFloat),
    cashSales: money(s.cashSales),
    cardSales: money(s.cardSales),
    paidWithRewards: money(s.loyaltyRedemptions),
    cashIn: money(deposits),
    cashOut: money(withdrawals),
    movements: [
      ...(s.deposits || []).map((d) => ({ type: 'in', amount: money(d.amount), reason: d.description || null, at: d.ts || null })),
      ...(s.withdrawals || []).map((w) => ({ type: 'out', amount: money(w.amount), reason: w.description || null, at: w.ts || null })),
    ],
    expectedCash: money(expected),
    countedCash: closed && s.closingCash != null ? money(s.closingCash) : null,
    difference: closed && s.closingCash != null ? money(Number(s.closingCash) - expected) : null,
  }
}
