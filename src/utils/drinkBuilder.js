// "Arma tu bebida" — the customer builds a drink from scratch.
//
// Everything the builder shows (steps, ingredients, prices, colors) comes
// from ONE Firestore document, settings/drinkBuilder, which the admin panel
// will edit. Nothing about the café's ingredients lives in code. Shape:
//
// {
//   enabled: true,
//   title: 'Arma tu bebida',            // optional, defaults below
//   tagline: 'Tu bebida, a tu manera',  // optional
//   basePrice: 55,                      // price before any ingredient
//   stationTags: ['barra'],             // optional kitchen routing
//   steps: [{
//     id: 'base',
//     name: 'Base',
//     hint: 'Lo que le da cuerpo',      // optional helper line
//     type: 'single' | 'multi',
//     required: true,
//     maxSelections: 2,                 // multi only; empty = no limit
//     visual: 'liquid' | 'pearls' | 'foam' | 'ice' | 'none',
//     showIf: { estilo: ['iced', 'frappe'] },   // optional, see below
//     options: [{
//       id, name, desc, priceModifier,
//       color: '#e4d6f5',               // how it looks in the cup
//       amount: 0.5,                    // 'ice' only: 0 none … 1 full
//       isActive: true,
//       showIf: { base: ['leche'] },    // optional, see below
//     }],
//   }],
// }
//
// `showIf` makes a step or an ingredient conditional on earlier choices:
// { [earlierStepId]: optionId[] }. It's offered only when, for EVERY listed
// step, the customer picked at least ONE of the listed options. So "Hielo"
// with { estilo: ['iced', 'frappe'] } disappears for a hot drink, and "Taro"
// with { base: ['leche'] } can't be picked on a water base. Changing an
// earlier choice removes picks that no longer apply (see resolveBuilder).
//
// `visual` tells the animated cup how a step looks: liquids tint the drink
// (several make an ombré), pearls drop to the bottom, foam sits on top and
// ice floats. 'none' = doesn't change the cup (e.g. sweetness level).

export const DRINK_BUILDER_HASH = '#arma-tu-bebida'
export const DRINK_BUILDER_ITEM_ID = 'arma-tu-bebida'
export const DEFAULT_TITLE = 'Arma tu bebida'
export const DEFAULT_TAGLINE = 'Tú eliges cada capa. Nosotros la preparamos.'
export const NAME_MAX = 24

const VISUALS = ['liquid', 'pearls', 'foam', 'ice', 'none']

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const normalizeCondition = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out = {}
  for (const [stepId, ids] of Object.entries(raw)) {
    const list = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean)
    if (list.length) out[stepId] = list
  }
  return Object.keys(out).length ? out : null
}

// True when a showIf rule is satisfied by the current selections.
export const conditionMet = (showIf, selections) =>
  !showIf || Object.entries(showIf).every(([stepId, ids]) => (selections[stepId] || []).some((id) => ids.includes(id)))

// Cleans the raw Firestore document: drops inactive/empty options and steps
// with nothing to choose, fills defaults. Returns null when the builder
// shouldn't be shown at all.
export const normalizeBuilderConfig = (raw) => {
  if (!raw || raw.enabled === false || !Array.isArray(raw.steps)) return null
  const steps = raw.steps
    .map((step, i) => {
      const options = (Array.isArray(step?.options) ? step.options : [])
        .filter((o) => o && o.isActive !== false && String(o.name || '').trim())
        .map((o, j) => ({
          id: String(o.id ?? `${step?.id ?? i}-${j}`),
          name: String(o.name).trim(),
          desc: String(o.desc || '').trim(),
          priceModifier: toNumber(o.priceModifier),
          color: typeof o.color === 'string' && o.color.trim() ? o.color.trim() : null,
          amount: o.amount == null ? 1 : Math.min(1, Math.max(0, toNumber(o.amount))),
          showIf: normalizeCondition(o.showIf),
        }))
      const type = step?.type === 'multi' ? 'multi' : 'single'
      const max = toNumber(step?.maxSelections)
      return {
        id: String(step?.id ?? `step-${i}`),
        name: String(step?.name || `Paso ${i + 1}`).trim(),
        hint: String(step?.hint || '').trim(),
        type,
        required: Boolean(step?.required),
        maxSelections: type === 'multi' && max > 0 ? max : null,
        visual: VISUALS.includes(step?.visual) ? step.visual : 'none',
        showIf: normalizeCondition(step?.showIf),
        options,
      }
    })
    .filter((s) => s.options.length > 0)
  if (steps.length === 0) return null
  return {
    title: String(raw.title || '').trim() || DEFAULT_TITLE,
    tagline: String(raw.tagline || '').trim() || DEFAULT_TAGLINE,
    basePrice: toNumber(raw.basePrice),
    stationTags: Array.isArray(raw.stationTags) ? raw.stationTags.filter(Boolean) : [],
    steps,
  }
}

// What the customer can actually choose right now: the steps and options
// whose showIf is met, plus the selections with every pick that no longer
// applies removed. Conditions only look at earlier steps, so one pass in
// order settles everything (a removed pick also hides what depended on it).
// Every other helper below can then be called with the returned config.
export const resolveBuilder = (config, selections) => {
  const steps = []
  const kept = {}
  for (const step of config.steps) {
    if (!conditionMet(step.showIf, kept)) continue
    const options = step.options.filter((o) => conditionMet(o.showIf, kept))
    if (!options.length) continue
    steps.push(options.length === step.options.length ? step : { ...step, options })
    const ids = (selections[step.id] || []).filter((id) => options.some((o) => o.id === id))
    if (ids.length) kept[step.id] = ids
  }
  return { config: { ...config, steps }, selections: kept }
}

// selections: { [stepId]: optionId[] } — order of choice is kept.
export const toggleSelection = (selections, step, optionId) => {
  const current = selections[step.id] || []
  if (step.type === 'single') {
    // Tapping the chosen option again clears it only when the step is optional.
    if (current[0] === optionId) return step.required ? selections : { ...selections, [step.id]: [] }
    return { ...selections, [step.id]: [optionId] }
  }
  if (current.includes(optionId)) {
    return { ...selections, [step.id]: current.filter((id) => id !== optionId) }
  }
  if (step.maxSelections && current.length >= step.maxSelections) {
    // At the limit: the oldest choice makes room for the new one.
    return { ...selections, [step.id]: [...current.slice(1), optionId] }
  }
  return { ...selections, [step.id]: [...current, optionId] }
}

export const selectedOptionsOf = (step, selections) => {
  const ids = selections[step.id] || []
  return ids.map((id) => step.options.find((o) => o.id === id)).filter(Boolean)
}

export const isStepComplete = (step, selections) =>
  !step.required || selectedOptionsOf(step, selections).length > 0

export const firstIncompleteStep = (config, selections) =>
  config.steps.findIndex((s) => !isStepComplete(s, selections))

export const computeTotal = (config, selections) =>
  config.steps.reduce(
    (sum, step) => sum + selectedOptionsOf(step, selections).reduce((s, o) => s + o.priceModifier, 0),
    config.basePrice
  )

// What the animated cup draws.
export const deriveCupVisual = (config, selections) => {
  const visual = { liquids: [], pearls: [], foam: null, ice: null }
  for (const step of config.steps) {
    const chosen = selectedOptionsOf(step, selections)
    if (!chosen.length) continue
    if (step.visual === 'liquid') visual.liquids.push(...chosen.map((o) => ({ id: o.id, color: o.color })))
    if (step.visual === 'pearls') visual.pearls.push(...chosen.map((o) => ({ id: o.id, color: o.color })))
    if (step.visual === 'foam') visual.foam = { id: chosen[0].id, color: chosen[0].color }
    if (step.visual === 'ice') visual.ice = { id: chosen[0].id, amount: chosen[0].amount }
  }
  return visual
}

// Random but valid drink: every required step gets something, optional
// steps get something about half the time, conditions are respected.
export const randomSelections = (config, rand = Math.random) => {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const out = {}
  for (const step of config.steps) {
    // Only what the choices so far allow (same rules as resolveBuilder).
    if (!conditionMet(step.showIf, out)) continue
    const options = step.options.filter((o) => conditionMet(o.showIf, out))
    if (!options.length) continue
    if (!step.required && rand() < 0.4) { out[step.id] = []; continue }
    if (step.type === 'single') { out[step.id] = [pick(options).id]; continue }
    const limit = Math.min(step.maxSelections || 2, options.length, 2)
    const count = 1 + Math.floor(rand() * limit)
    const pool = [...options]
    const chosen = []
    while (chosen.length < count && pool.length) {
      chosen.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].id)
    }
    out[step.id] = chosen
  }
  return out
}

// Fun, gender-neutral name ideas built around the most distinctive choice
// ("Nube de Taro", "Galaxia de Mango").
const NAME_PATTERNS = [
  'Nube de', 'Galaxia de', 'Ola de', 'Remolino de', 'Explosión de',
  'Sueño de', 'Lluvia de', 'Fiesta de', 'Volcán de', 'Brisa de',
]

export const suggestName = (config, selections, rand = Math.random) => {
  const liquids = config.steps
    .filter((s) => s.visual === 'liquid')
    .flatMap((s) => selectedOptionsOf(s, selections))
  const anyChoice = config.steps.flatMap((s) => selectedOptionsOf(s, selections))
  const star = liquids[liquids.length - 1] ?? anyChoice[0]
  if (!star) return ''
  const pattern = NAME_PATTERNS[Math.floor(rand() * NAME_PATTERNS.length)]
  return `${pattern} ${star.name}`.slice(0, NAME_MAX)
}

// Cart line in the same shape the menu's other products use, so the cart,
// WhatsApp message, POS, kitchen board and receipts all work unchanged.
export const buildCartItem = (config, selections, customName = '') => {
  const name = customName.trim().slice(0, NAME_MAX)
  return {
    id: DRINK_BUILDER_ITEM_ID,
    // recipes/arma-tu-bebida — paying the order deducts each choice's raw
    // materials (see utils/drinkBuilderAdmin.js).
    productDocId: DRINK_BUILDER_ITEM_ID,
    name: name ? `${config.title}: ${name}` : config.title,
    price: config.basePrice,
    stationTags: config.stationTags,
    selectedOptions: config.steps.flatMap((step) =>
      selectedOptionsOf(step, selections).map((o) => ({
        groupId: step.id,
        groupName: step.name,
        optionId: o.id,
        optionName: o.name,
        priceModifier: o.priceModifier,
      }))
    ),
  }
}

// Reverse of buildCartItem, for editing a ticket/cart line: its selections
// (skipping choices that no longer exist or no longer apply) and its custom name.
export const selectionsFromItem = (config, item) => {
  const out = {}
  for (const so of item?.selectedOptions || []) {
    const step = config.steps.find((s) => s.id === so.groupId)
    if (!step?.options.some((o) => o.id === so.optionId)) continue
    out[step.id] = [...(out[step.id] || []), so.optionId]
  }
  return resolveBuilder(config, out).selections
}

export const nameFromItem = (config, item) => {
  const prefix = `${config.title}: `
  return item?.name?.startsWith(prefix) ? item.name.slice(prefix.length) : ''
}
