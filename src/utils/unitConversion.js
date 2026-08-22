// Pure unit-conversion math — decoupled from display labels, which
// src/views/admin/Stock.jsx already owns (UNIT_OPTIONS / unitLabel / unitShort).
// Unit ids here must match what's already stored in Firestore
// (rawMaterials.unit, recipe ingredient.unit): never rename an existing id,
// only add new ones — renaming orphans every material/recipe already saved
// with the old value.
const UNIT_META = {
  liter: { family: 'volume', baseMultiplier: 1000 }, // base: ml
  ml:    { family: 'volume', baseMultiplier: 1 },
  kg:    { family: 'weight', baseMultiplier: 1000 }, // base: grams
  grams: { family: 'weight', baseMultiplier: 1 },
  units: { family: 'count',  baseMultiplier: 1 },    // base: units
  // Simplification: 1 box = 1 "unit" of conversion — a box's real contents
  // count isn't modeled, so box<->units conversion is a 1:1 placeholder.
  box:   { family: 'count',  baseMultiplier: 1 },
}

export const unitFamily = (unitId) => UNIT_META[unitId]?.family ?? null

// All unit ids sharing a family with `unitId` (including itself). Falls back to
// [unitId] for an unrecognized id so callers always get a non-empty, valid list.
export const getUnitsInFamily = (unitId) => {
  const family = unitFamily(unitId)
  if (!family) return unitId ? [unitId] : []
  return Object.keys(UNIT_META).filter((id) => UNIT_META[id].family === family)
}

// Converts `quantity` from one unit to another within the same family.
// Returns `quantity` unchanged if either unit is unrecognized or they're in
// different families — callers should only ever offer same-family units in
// the UI, but this stays a safe no-op rather than throwing on stale data.
export const convertUnits = (quantity, fromUnitId, toUnitId) => {
  if (fromUnitId === toUnitId) return quantity
  const from = UNIT_META[fromUnitId]
  const to = UNIT_META[toUnitId]
  if (!from || !to || from.family !== to.family) return quantity
  const base = quantity * from.baseMultiplier
  return Number((base / to.baseMultiplier).toFixed(6))
}
