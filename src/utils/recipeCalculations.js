import { convertUnits } from './unitConversion'

export const UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'liter', label: 'litro' },
  { value: 'ml', label: 'ml' },
  { value: 'box', label: 'caja' },
  { value: 'units', label: 'unidad' },
  { value: 'grams', label: 'g' },
]

const unitShortLabels = { kg: 'kg', liter: 'L', ml: 'ml', box: ' caja(s)', units: ' u.', grams: 'g' }

export const RECIPE_SORT_OPTIONS = [
  { key: null, label: 'Alfabético' },
  { key: 'margin', label: 'Menor margen' },
  { key: 'cogs', label: 'Mayor COGS' },
]

export const getUnitLabel = (value) => UNIT_OPTIONS.find((unit) => unit.value === value)?.label ?? value
export const getUnitShortLabel = (value) => unitShortLabels[value] ?? value
export const formatQuantity = (value) => Number((value ?? 0).toFixed(4)).toString()

export const getMarginColor = (margin) => {
  if (margin == null) return 'text-light-200/40'
  if (margin < 0) return 'text-rose-400'
  if (margin > 80) return 'text-emerald-400'
  if (margin >= 60) return 'text-amber-400'
  return 'text-orange-400'
}

export const computeIngredientTotals = (ingredients = [], materials = []) =>
  ingredients.map((ingredient) => {
    const material = materials.find((entry) => entry.docId === ingredient.materialId)
    const materialUnit = material?.unit ?? null
    const recipeUnit = ingredient.unit || materialUnit
    const quantity = Number(ingredient.quantity)
    const unitCost = material?.costPerUnit ?? 0
    const quantityInMaterialUnit = Number.isFinite(quantity) && quantity > 0 && materialUnit && recipeUnit
      ? convertUnits(quantity, recipeUnit, materialUnit)
      : 0
    const totalCost = quantityInMaterialUnit > 0 ? quantityInMaterialUnit * unitCost : 0

    return { ...ingredient, material, unit: recipeUnit, materialUnit, quantityInMaterialUnit, unitCost, totalCost }
  })

export const validateIngredientRows = (rows = []) =>
  rows.some((row) => !row.materialId || !(Number(row.quantity) > 0))
    ? 'Completa material y cantidad válidos en cada ingrediente.'
    : null

export const computeGroupBounds = (group, costs = []) => {
  if (!costs.length) return { min: 0, max: 0 }
  if (group.type === 'multi') return { min: 0, max: costs.reduce((total, cost) => total + cost, 0) }

  return {
    min: group.required ? Math.min(...costs) : 0,
    max: Math.max(...costs),
  }
}

export const buildOptionGroupsDraft = (optionGroups = [], existingRecipe) =>
  optionGroups.reduce((draft, group) => {
    const options = (group.options || []).reduce((optionDraft, option) => {
      const stored = existingRecipe?.optionIngredients?.[group.id]?.options?.[option.id]?.ingredients || []
      optionDraft[option.id] = stored.map((ingredient) => ({
        materialId: ingredient.materialId,
        quantity: String(ingredient.quantity),
        unit: ingredient.unit,
      }))
      return optionDraft
    }, {})

    draft[group.id] = { activeOptionId: group.options?.[0]?.id ?? null, options }
    return draft
  }, {})

export const getRecipeSummary = (product, recipe) => {
  const optionGroups = Array.isArray(product?.optionGroups) ? product.optionGroups : []
  if (!recipe?.fixedIngredients?.length) {
    return { hasRecipe: false, hasRange: false, minCogs: null, maxCogs: null, minMargin: null, maxMargin: null }
  }

  const minCogs = recipe.minCogs ?? recipe.fixedCogs ?? 0
  const maxCogs = recipe.maxCogs ?? recipe.fixedCogs ?? 0
  return {
    hasRecipe: true,
    hasRange: optionGroups.length > 0 && maxCogs !== minCogs,
    minCogs,
    maxCogs,
    minMargin: recipe.minMarginPercent ?? 0,
    maxMargin: recipe.maxMarginPercent ?? 0,
  }
}
