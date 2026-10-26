// Single source of truth for Finance revenue / COGS / profit calculations.
// Every Finance tab reads from enrichOrderFinancials() so the numbers always agree.

const normalizeName = (s) => (s || '').trim().toLowerCase()

const stripOptionSuffix = (name) => normalizeName(name).replace(/\s*\([^)]+\)\s*$/, '').trim()

const parseProductNameAndOptions = (rawName) => {
  const match = (rawName || '').trim().match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (match) {
    return {
      name: match[1].trim(),
      selectedOptions: [{ optionName: match[2].trim() }],
    }
  }
  return { name: (rawName || '').trim(), selectedOptions: [] }
}

export const itemLineTotal = (item) =>
  (Number(item.price || 0)
    + (item.selectedOptions || []).reduce((s, o) => s + Number(o.priceModifier || 0), 0)
    + (item.selectedToppings || []).reduce((s, t) => s + Number(t.price || 0), 0)
  ) * (item.qty || 1)

// Legacy format: "1. 2 x ProductName (option) - $XX.00" or "2 x ProductName - $XX.00"
const parseItemsFromContent = (content = '') =>
  content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\bx\s/.test(l))
    .map((l) => {
      const match = l.match(/^(?:\d+\.\s*)?(\d+)\s*x\s+(.+?)\s*-\s*\$?\s*([\d,.]+)\s*$/)
      if (!match) {
        const fallback = l.match(/^(?:\d+\.\s*)?(\d+)\s*x\s+(.+?)(?:\s*-\s*\$|\s*$)/)
        if (!fallback) return null
        const parsed = parseProductNameAndOptions(fallback[2])
        return {
          name: parsed.name,
          qty: Number(fallback[1] || 1),
          price: 0,
          selectedOptions: parsed.selectedOptions,
          selectedToppings: [],
        }
      }
      const qty = Number(match[1] || 1)
      const lineTotal = Number(match[3].replace(/,/g, ''))
      const parsed = parseProductNameAndOptions(match[2])
      return {
        name: parsed.name,
        qty,
        price: qty > 0 ? lineTotal / qty : lineTotal,
        selectedOptions: parsed.selectedOptions,
        selectedToppings: [],
      }
    })
    .filter(Boolean)

export const getOrderLineItems = (order) => {
  if (Array.isArray(order.items) && order.items.length > 0) return order.items
  return parseItemsFromContent(order.content)
}

export const computeOrderRevenue = (order) => {
  const items = getOrderLineItems(order)
  if (items.length > 0) {
    const fromItems = items.reduce((sum, it) => sum + itemLineTotal(it), 0)
    if (fromItems > 0) return Number(fromItems.toFixed(2))
  }

  const pm = order.paymentMethods
  if (pm) {
    const paid = Number(pm.cash || 0) + Number(pm.card || 0) + Number(pm.loyalty || 0)
    const stored = Number(order.total || 0)
    // Pre-2026-08-04 loyalty bug: order.total was the discounted remainder, not the sale value.
    if (paid > stored + 0.005) return Number(paid.toFixed(2))
  }

  return Number(order.total || 0)
}

export const resolveProductDocId = (item, docIdByLegacyId, nameToDocId) => {
  if (item.productDocId) return item.productDocId
  if (item.id != null) {
    const legacy = docIdByLegacyId[item.id]
      ?? docIdByLegacyId[String(item.id)]
      ?? docIdByLegacyId[Number(item.id)]
    if (legacy) return legacy
  }
  if (item.name && nameToDocId) {
    const normalized = normalizeName(item.name)
    return nameToDocId[normalized] || nameToDocId[stripOptionSuffix(item.name)] || null
  }
  return null
}

const appendOptionIngredients = (recipe, ingredientLines, groupId, optionId, optionName) => {
  if (groupId && optionId) {
    const optionData = recipe.optionIngredients?.[groupId]?.options?.[optionId]
    if (optionData?.ingredients?.length) ingredientLines.push(...optionData.ingredients)
    return
  }
  if (!optionName) return
  const target = normalizeName(optionName)
  for (const group of Object.values(recipe.optionIngredients || {})) {
    for (const optionData of Object.values(group.options || {})) {
      if (normalizeName(optionData.optionName) === target && optionData.ingredients?.length) {
        ingredientLines.push(...optionData.ingredients)
        return
      }
    }
  }
}

export const estimateItemCost = (item, recipesById, docIdByLegacyId, nameToDocId) => {
  const productDocId = resolveProductDocId(item, docIdByLegacyId, nameToDocId)
  const recipe = productDocId ? recipesById[productDocId] : null
  if (!recipe) return null

  const ingredientLines = [...(recipe.fixedIngredients || [])]
  for (const so of item.selectedOptions || []) {
    appendOptionIngredients(recipe, ingredientLines, so.groupId, so.optionId, so.optionName)
  }

  if (ingredientLines.length === 0) return null

  const costPerUnit = ingredientLines.reduce((sum, ing) => sum + Number(ing.totalCost || 0), 0)
  return Number((costPerUnit * (item.qty || 1)).toFixed(2))
}

export const resolveItemCost = (item, recipesById, docIdByLegacyId, nameToDocId) => {
  if (typeof item.totalCost === 'number') {
    return { cost: item.totalCost, estimated: false }
  }
  const estimatedCost = estimateItemCost(item, recipesById, docIdByLegacyId, nameToDocId)
  if (estimatedCost != null) return { cost: estimatedCost, estimated: true }
  return { cost: null, estimated: false }
}

// uncostedRevenue = the part of the sale whose ingredient cost is unknown
// (product without a recipe). Its cost counts as $0, so profit on it is
// overstated — Finance surfaces this instead of hiding it.
export const resolveOrderCogs = (order, recipesById, docIdByLegacyId, nameToDocId) => {
  const items = getOrderLineItems(order)
  if (items.length === 0) {
    const cogs = typeof order.totalCogs === 'number' ? order.totalCogs : 0
    return { cogs, estimated: false, items, uncostedRevenue: cogs > 0 ? 0 : computeOrderRevenue(order) }
  }

  let cogs = 0
  let estimated = false
  let uncostedRevenue = 0
  const enrichedItems = []

  for (const item of items) {
    const { cost, estimated: itemEstimated } = resolveItemCost(item, recipesById, docIdByLegacyId, nameToDocId)
    enrichedItems.push({
      ...item,
      totalCost: cost,
      costEstimated: itemEstimated,
    })
    if (cost != null) {
      cogs += cost
      if (itemEstimated) estimated = true
    } else {
      uncostedRevenue += itemLineTotal(item)
    }
  }

  if (cogs === 0 && typeof order.totalCogs === 'number' && order.totalCogs > 0) {
    return { cogs: order.totalCogs, estimated: false, items: enrichedItems, uncostedRevenue: 0 }
  }

  if (cogs === 0 && typeof order.grossProfit === 'number') {
    const revenue = computeOrderRevenue(order)
    if (revenue > order.grossProfit) {
      return {
        cogs: Number((revenue - order.grossProfit).toFixed(2)),
        estimated: false,
        items: enrichedItems,
        uncostedRevenue: 0,
      }
    }
  }

  return { cogs: Number(cogs.toFixed(2)), estimated, items: enrichedItems, uncostedRevenue: Number(uncostedRevenue.toFixed(2)) }
}

export const enrichOrderFinancials = (order, recipesById, docIdByLegacyId, nameToDocId) => {
  const revenue = computeOrderRevenue(order)
  const { cogs, estimated, items, uncostedRevenue } = resolveOrderCogs(order, recipesById, docIdByLegacyId, nameToDocId)
  const grossProfit = Number((revenue - cogs).toFixed(2))
  const profitMargin = revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(1)) : 0

  return {
    ...order,
    items,
    revenue,
    totalCogs: cogs,
    grossProfit,
    profitMargin,
    costEstimated: estimated,
    uncostedRevenue,
  }
}

export const orderDate = (order) =>
  order.completedAt?.toDate?.() ?? order.createdAt?.toDate?.() ?? null

export const localDayKey = (d) =>
  [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')

const round2 = (n) => Number(n.toFixed(2))

// Day-by-day money for the Finance "Día a día" chart. Every calendar day in
// [start, end] gets a row — days without sales are $0, not skipped (a skipped
// day made the line jump straight from one sale day to the next). `end` is
// capped at today so the future isn't drawn as zero sales.
//   revenue      what customers paid (enriched order.revenue)
//   cogs         ingredient cost of those sales
//   grossProfit  revenue − cogs
//   fixedCosts   rent, wages… spread per day (fixedCostForDay)
//   netProfit    grossProfit − fixedCosts → what the café actually kept
//   uncostedRevenue  sales of products with no recipe (their cost counts as $0)
// `orders` must already be paid + enriched (enrichOrderFinancials).
export const buildDailyTrend = (orders, { start, end, now = new Date(), fixedCostForDay = () => 0 }) => {
  const last = end < now ? end : now
  const days = []
  const byKey = {}
  for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= last; d.setDate(d.getDate() + 1)) {
    const date = new Date(d)
    const row = {
      key: localDayKey(date),
      date,
      revenue: 0, cogs: 0, uncostedRevenue: 0, orderCount: 0,
      fixedCosts: round2(fixedCostForDay(date)),
    }
    days.push(row)
    byKey[row.key] = row
  }
  for (const order of orders) {
    const d = orderDate(order)
    const row = d && byKey[localDayKey(d)]
    if (!row) continue
    row.revenue += Number(order.revenue ?? order.total ?? 0)
    row.cogs += Number(order.totalCogs || 0)
    row.uncostedRevenue += Number(order.uncostedRevenue || 0)
    row.orderCount += 1
  }
  return days.map((row) => {
    const revenue = round2(row.revenue)
    const cogs = round2(row.cogs)
    const grossProfit = round2(revenue - cogs)
    return {
      ...row,
      revenue, cogs, grossProfit,
      uncostedRevenue: round2(row.uncostedRevenue),
      netProfit: round2(grossProfit - row.fixedCosts),
    }
  })
}

export const summarizeTrend = (days) => {
  const sum = (field) => round2(days.reduce((s, d) => s + d[field], 0))
  const revenue = sum('revenue')
  const uncostedRevenue = sum('uncostedRevenue')
  return {
    revenue,
    cogs: sum('cogs'),
    grossProfit: sum('grossProfit'),
    fixedCosts: sum('fixedCosts'),
    netProfit: sum('netProfit'),
    uncostedRevenue,
    uncostedShare: revenue > 0 ? uncostedRevenue / revenue : 0,
    orderCount: days.reduce((s, d) => s + d.orderCount, 0),
    daysWithSales: days.filter((d) => d.orderCount > 0).length,
  }
}

export const buildNameToDocIdMap = (products) => {
  const map = {}
  for (const p of products) {
    if (p.name && p.docId) map[normalizeName(p.name)] = p.docId
  }
  return map
}

export const buildDocIdByLegacyIdMap = (products) => {
  const map = {}
  for (const p of products) {
    if (p.id != null && p.docId) {
      map[p.id] = p.docId
      map[String(p.id)] = p.docId
      map[Number(p.id)] = p.docId
    }
  }
  return map
}
