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

export const resolveOrderCogs = (order, recipesById, docIdByLegacyId, nameToDocId) => {
  const items = getOrderLineItems(order)
  if (items.length === 0) {
    const cogs = typeof order.totalCogs === 'number' ? order.totalCogs : 0
    return { cogs, estimated: false, items }
  }

  let cogs = 0
  let estimated = false
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
    }
  }

  if (cogs === 0 && typeof order.totalCogs === 'number' && order.totalCogs > 0) {
    return { cogs: order.totalCogs, estimated: false, items: enrichedItems }
  }

  if (cogs === 0 && typeof order.grossProfit === 'number') {
    const revenue = computeOrderRevenue(order)
    if (revenue > order.grossProfit) {
      return {
        cogs: Number((revenue - order.grossProfit).toFixed(2)),
        estimated: false,
        items: enrichedItems,
      }
    }
  }

  return { cogs: Number(cogs.toFixed(2)), estimated, items: enrichedItems }
}

export const enrichOrderFinancials = (order, recipesById, docIdByLegacyId, nameToDocId) => {
  const revenue = computeOrderRevenue(order)
  const { cogs, estimated, items } = resolveOrderCogs(order, recipesById, docIdByLegacyId, nameToDocId)
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
  }
}

export const orderDate = (order) =>
  order.completedAt?.toDate?.() ?? order.createdAt?.toDate?.() ?? null

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
