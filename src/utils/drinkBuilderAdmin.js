// Admin side of "Arma tu bebida": turns the two stored documents into one
// editable draft and back.
//
//   settings/drinkBuilder      → what customers see (steps, ingredients,
//                                prices, colors). Publicly readable.
//   recipes/arma-tu-bebida     → how much raw material each choice uses.
//                                Same shape as every product recipe made in
//                                Stock, so paying an order deducts stock and
//                                Finanzas computes cost with no extra code:
//                                  fixedIngredients  → used by every drink
//                                  optionIngredients[stepId].options[optionId]
//
// Costs/quantities live only in the recipe (staff-only), never in the
// public settings document.
import { computeIngredientTotals } from './recipeCalculations.js'
import { DRINK_BUILDER_ITEM_ID } from './drinkBuilder.js'

export const DRINK_RECIPE_ID = DRINK_BUILDER_ITEM_ID

export const VISUAL_OPTIONS = [
  { value: 'liquid', label: 'Líquido', hint: 'Llena y pinta la bebida' },
  { value: 'pearls', label: 'Perlas', hint: 'Caen al fondo del vaso' },
  { value: 'foam', label: 'Espuma', hint: 'Una nube encima' },
  { value: 'ice', label: 'Hielo', hint: 'Cubos flotando' },
  { value: 'none', label: 'Ninguno', hint: 'No cambia el dibujo' },
]

export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const numOrEmpty = (v) => (v === null || v === undefined || v === '' ? '' : String(v))

const ingredientsToDraft = (lines = []) =>
  lines.map((l) => ({ materialId: l.materialId || '', quantity: numOrEmpty(l.quantity), unit: l.unit || '' }))

export const createDraftOption = () => ({
  id: newId('ing'), name: '', desc: '', priceModifier: '', color: '', amount: 1, isActive: true, ingredients: [],
})

export const createDraftStep = () => ({
  id: newId('paso'), name: '', hint: '', type: 'single', required: false, maxSelections: '', visual: 'none',
  options: [createDraftOption()],
})

export const draftFromDocs = (config, recipe) => {
  const optionLines = recipe?.optionIngredients || {}
  return {
    enabled: config ? config.enabled !== false : false,
    title: config?.title || '',
    tagline: config?.tagline || '',
    basePrice: numOrEmpty(config?.basePrice),
    stationTags: Array.isArray(config?.stationTags) ? config.stationTags : [],
    baseIngredients: ingredientsToDraft(recipe?.fixedIngredients),
    steps: (config?.steps || []).map((s) => ({
      id: s.id || newId('paso'),
      name: s.name || '',
      hint: s.hint || '',
      type: s.type === 'multi' ? 'multi' : 'single',
      required: Boolean(s.required),
      maxSelections: numOrEmpty(s.maxSelections),
      visual: s.visual || 'none',
      options: (s.options || []).map((o) => ({
        id: o.id || newId('ing'),
        name: o.name || '',
        desc: o.desc || '',
        priceModifier: numOrEmpty(o.priceModifier),
        color: o.color || '',
        amount: o.amount == null ? 1 : Number(o.amount),
        isActive: o.isActive !== false,
        ingredients: ingredientsToDraft(optionLines[s.id]?.options?.[o.id]?.ingredients),
      })),
    })),
  }
}

const money = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0
}

// The public document (no ingredients/costs).
export const configFromDraft = (draft) => ({
  enabled: Boolean(draft.enabled),
  title: draft.title.trim(),
  tagline: draft.tagline.trim(),
  basePrice: money(draft.basePrice),
  stationTags: draft.stationTags,
  steps: draft.steps.map((s) => ({
    id: s.id,
    name: s.name.trim(),
    hint: s.hint.trim(),
    type: s.type,
    required: s.required,
    maxSelections: s.type === 'multi' && Number(s.maxSelections) > 0 ? Math.floor(Number(s.maxSelections)) : null,
    visual: s.visual,
    options: s.options.map((o) => {
      const out = {
        id: o.id,
        name: o.name.trim(),
        desc: o.desc.trim(),
        priceModifier: money(o.priceModifier),
        isActive: o.isActive,
      }
      if (o.color) out.color = o.color
      if (s.visual === 'ice') out.amount = Number(o.amount)
      return out
    }),
  })),
})

const usedRows = (rows = []) => rows.filter((r) => r.materialId || String(r.quantity).trim())

// Recipe ingredient lines with cost snapshot — identical fields to the lines
// Stock's recipe editor saves, so stock deduction treats them the same.
export const recipeLines = (rows, materials) =>
  computeIngredientTotals(usedRows(rows), materials).map((r) => ({
    materialId: r.materialId,
    materialName: r.material?.name || '',
    quantity: Number(r.quantity),
    unit: r.unit || '',
    materialUnit: r.materialUnit || '',
    quantityInMaterialUnit: Number((r.quantityInMaterialUnit || 0).toFixed(6)),
    unitCost: r.unitCost,
    totalCost: Number(r.totalCost.toFixed(2)),
  }))

export const linesCost = (rows, materials) =>
  Number(recipeLines(rows, materials).reduce((sum, l) => sum + l.totalCost, 0).toFixed(2))

// Cheapest / priciest possible drink, for price and for cost separately.
// Required single steps take their min/max option; multi steps add up to
// their limit (max side only); optional steps can add nothing.
export const drinkRanges = (draft, materials) => {
  const base = { price: money(draft.basePrice), cost: linesCost(draft.baseIngredients, materials) }
  const range = { minPrice: base.price, maxPrice: base.price, minCost: base.cost, maxCost: base.cost }
  for (const s of draft.steps) {
    const active = s.options.filter((o) => o.isActive && o.name.trim())
    if (!active.length) continue
    const prices = active.map((o) => money(o.priceModifier))
    const costs = active.map((o) => linesCost(o.ingredients, materials))
    const limit = s.type === 'multi' ? (Number(s.maxSelections) > 0 ? Number(s.maxSelections) : active.length) : 1
    const topSum = (arr) => [...arr].sort((a, b) => b - a).slice(0, limit).reduce((a, b) => a + b, 0)
    if (s.required) {
      range.minPrice += Math.min(...prices)
      range.minCost += Math.min(...costs)
    }
    range.maxPrice += topSum(prices)
    range.maxCost += topSum(costs)
  }
  for (const k of Object.keys(range)) range[k] = Number(range[k].toFixed(2))
  return range
}

const marginPct = (price, cost) => (price > 0 ? Number((((price - cost) / price) * 100).toFixed(1)) : 0)

export const recipeFromDraft = (draft, materials) => {
  const fixedIngredients = recipeLines(draft.baseIngredients, materials)
  const optionIngredients = {}
  for (const s of draft.steps) {
    const options = {}
    for (const o of s.options) {
      const ingredients = recipeLines(o.ingredients, materials)
      options[o.id] = {
        optionName: o.name.trim(),
        ingredients,
        totalCost: Number(ingredients.reduce((sum, l) => sum + l.totalCost, 0).toFixed(2)),
      }
    }
    optionIngredients[s.id] = { groupName: s.name.trim(), options }
  }
  const r = drinkRanges(draft, materials)
  return {
    productId: DRINK_RECIPE_ID,
    productName: draft.title.trim() || 'Arma tu bebida',
    sellingPrice: money(draft.basePrice),
    fixedIngredients,
    fixedCogs: Number(fixedIngredients.reduce((sum, l) => sum + l.totalCost, 0).toFixed(2)),
    optionIngredients,
    minCogs: r.minCost,
    maxCogs: r.maxCost,
    minMarginPercent: Math.min(marginPct(r.minPrice, r.minCost), marginPct(r.maxPrice, r.maxCost)),
    maxMarginPercent: Math.max(marginPct(r.minPrice, r.minCost), marginPct(r.maxPrice, r.maxCost)),
    completionStatus: 'complete',
  }
}

const badRows = (rows) => usedRows(rows).some((r) => !r.materialId || !(Number(r.quantity) > 0))

// First problem found, phrased for the owner, plus where to fix it.
export const validateDraft = (draft) => {
  if (draft.enabled && !draft.steps.length) return { message: 'Agrega al menos un paso antes de mostrarlo en el menú.' }
  if (String(draft.basePrice).trim() && !(Number(draft.basePrice) >= 0)) return { message: 'El precio base no es válido.' }
  if (badRows(draft.baseIngredients)) return { message: 'En "Siempre se usa", completa material y cantidad en cada fila.' }
  for (const [si, s] of draft.steps.entries()) {
    const where = { stepIndex: si }
    if (!s.name.trim()) return { ...where, message: `El paso ${si + 1} necesita un nombre.` }
    if (!s.options.some((o) => o.name.trim() && o.isActive)) return { ...where, message: `"${s.name}" necesita al menos un ingrediente activo con nombre.` }
    if (s.type === 'multi' && String(s.maxSelections).trim() && !(Number(s.maxSelections) >= 1)) {
      return { ...where, message: `"${s.name}": el máximo debe ser 1 o más (o déjalo vacío para sin límite).` }
    }
    for (const o of s.options) {
      if (!o.name.trim() && (o.ingredients.length || String(o.priceModifier).trim())) return { ...where, message: `"${s.name}" tiene un ingrediente sin nombre.` }
      if (String(o.priceModifier).trim() && !(Number(o.priceModifier) >= 0)) return { ...where, message: `"${s.name}" → "${o.name}": el precio extra no es válido.` }
      if (badRows(o.ingredients)) return { ...where, message: `"${s.name}" → "${o.name}": completa material y cantidad en cada fila de inventario.` }
    }
  }
  return null
}

// Drops nameless placeholder options before saving.
export const cleanDraft = (draft) => ({
  ...draft,
  steps: draft.steps.map((s) => ({ ...s, options: s.options.filter((o) => o.name.trim()) })),
})
