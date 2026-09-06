import { describe, expect, it } from 'vitest'
import {
  buildOptionGroupsDraft,
  computeGroupBounds,
  computeIngredientTotals,
  getRecipeSummary,
  validateIngredientRows,
} from './recipeCalculations'

describe('recipe calculations', () => {
  const materials = [{ docId: 'milk', unit: 'liter', costPerUnit: 20 }]

  it('converts ingredient quantities before calculating cost', () => {
    const [ingredient] = computeIngredientTotals([{ materialId: 'milk', quantity: '250', unit: 'ml' }], materials)
    expect(ingredient.quantityInMaterialUnit).toBe(0.25)
    expect(ingredient.totalCost).toBe(5)
  })

  it('keeps required single-select and optional multi-select bounds intact', () => {
    expect(computeGroupBounds({ type: 'single', required: true }, [2, 4])).toEqual({ min: 2, max: 4 })
    expect(computeGroupBounds({ type: 'multi', required: false }, [2, 4])).toEqual({ min: 0, max: 6 })
  })

  it('preserves saved option ingredient drafts and validates incomplete rows', () => {
    const optionGroups = [{ id: 'size', options: [{ id: 'small' }] }]
    const recipe = { optionIngredients: { size: { options: { small: { ingredients: [{ materialId: 'milk', quantity: 1, unit: 'liter' }] } } } } }
    expect(buildOptionGroupsDraft(optionGroups, recipe).size.options.small).toEqual([{ materialId: 'milk', quantity: '1', unit: 'liter' }])
    expect(validateIngredientRows([{ materialId: 'milk', quantity: 0 }])).toBe('Completa material y cantidad válidos en cada ingrediente.')
  })

  it('returns the stored cost range used by recipe rows', () => {
    expect(getRecipeSummary({ optionGroups: [{}] }, {
      fixedIngredients: [{ materialId: 'milk' },],
      minCogs: 5,
      maxCogs: 9,
      minMarginPercent: 50,
      maxMarginPercent: 30,
    })).toMatchObject({ hasRecipe: true, hasRange: true, minCogs: 5, maxCogs: 9 })
  })
})
