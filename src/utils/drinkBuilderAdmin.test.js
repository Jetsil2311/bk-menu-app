import { describe, expect, it } from 'vitest'
import {
  cleanDraft, configFromDraft, describeCondition, draftFromDocs, drinkRanges, recipeFromDraft, toggleCondition,
  validateDraft,
} from './drinkBuilderAdmin'

// Made-up raw materials, same shape as the rawMaterials collection.
const MATERIALS = [
  { docId: 'milk', name: 'Leche', unit: 'liter', costPerUnit: 24 },      // $0.024 / ml
  { docId: 'cup', name: 'Vaso', unit: 'units', costPerUnit: 3 },
  { docId: 'syrup', name: 'Jarabe', unit: 'liter', costPerUnit: 200 },   // $0.20 / ml
  { docId: 'pearls', name: 'Perlas', unit: 'kg', costPerUnit: 100 },     // $0.10 / g
]

const CONFIG = {
  enabled: true, title: 'Arma tu bebida', basePrice: 50,
  steps: [
    { id: 'base', name: 'Base', type: 'single', required: true, visual: 'liquid',
      options: [{ id: 'leche', name: 'Leche', priceModifier: 0, color: '#fff' }] },
    { id: 'sabor', name: 'Sabor', type: 'multi', maxSelections: 2, required: true, visual: 'liquid',
      options: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', priceModifier: 10 }, { id: 'c', name: 'C', priceModifier: 5 }] },
    { id: 'perlas', name: 'Perlas', type: 'single', required: false, visual: 'pearls',
      options: [{ id: 'tap', name: 'Tapioca', priceModifier: 10 }] },
  ],
}

const RECIPE = {
  fixedIngredients: [{ materialId: 'cup', quantity: 1, unit: 'units' }],
  optionIngredients: {
    base: { options: { leche: { ingredients: [{ materialId: 'milk', quantity: 250, unit: 'ml' }] } } },
    sabor: { options: {
      a: { ingredients: [{ materialId: 'syrup', quantity: 20, unit: 'ml' }] },
      b: { ingredients: [{ materialId: 'syrup', quantity: 30, unit: 'ml' }] },
      c: { ingredients: [] },
    } },
    perlas: { options: { tap: { ingredients: [{ materialId: 'pearls', quantity: 60, unit: 'grams' }] } } },
  },
}

describe('draft round trip', () => {
  it('merges config + recipe into one draft and splits it back', () => {
    const draft = draftFromDocs(CONFIG, RECIPE)
    expect(draft.baseIngredients).toEqual([{ materialId: 'cup', quantity: '1', unit: 'units' }])
    expect(draft.steps[0].options[0].ingredients[0]).toEqual({ materialId: 'milk', quantity: '250', unit: 'ml' })

    const config = configFromDraft(draft)
    expect(config.steps[1].maxSelections).toBe(2)
    expect(config.steps[0].options[0]).not.toHaveProperty('ingredients')
    expect(JSON.stringify(config)).not.toMatch(/milk|syrup|cost/i)
  })

  it('starts empty and hidden when nothing is saved yet', () => {
    const draft = draftFromDocs(null, null)
    expect(draft).toMatchObject({ enabled: false, steps: [], baseIngredients: [] })
  })
})

describe('recipe for stock + finance', () => {
  const draft = draftFromDocs(CONFIG, RECIPE)

  it('writes lines with the material-unit quantity and cost snapshot', () => {
    const recipe = recipeFromDraft(draft, MATERIALS)
    expect(recipe.productId).toBe('arma-tu-bebida')
    expect(recipe.fixedIngredients[0]).toMatchObject({ materialId: 'cup', quantityInMaterialUnit: 1, totalCost: 3 })
    const milk = recipe.optionIngredients.base.options.leche.ingredients[0]
    expect(milk).toMatchObject({ materialName: 'Leche', quantityInMaterialUnit: 0.25, totalCost: 6 })
    expect(recipe.optionIngredients.perlas.options.tap.totalCost).toBe(6)
  })

  it('computes cheapest / priciest drink for price and cost', () => {
    // price: 50 + min(0) [base] + min(0,10,5) [sabor] ; max adds top 2 flavors (10+5) + pearls 10
    // cost: 3 + 6 + min(4,6,0) ; max: 3 + 6 + (6+4) + 6
    expect(drinkRanges(draft, MATERIALS)).toEqual({ minPrice: 50, maxPrice: 75, minCost: 9, maxCost: 25 })
  })
})

describe('validation', () => {
  const draft = draftFromDocs(CONFIG, RECIPE)

  it('accepts a complete draft', () => {
    expect(validateDraft(draft)).toBeNull()
  })

  it('points at the step with a half-filled inventory row', () => {
    const bad = structuredClone(draft)
    bad.steps[2].options[0].ingredients.push({ materialId: 'milk', quantity: '', unit: 'ml' })
    expect(validateDraft(bad)).toMatchObject({ stepIndex: 2 })
  })

  it('refuses to publish with no steps', () => {
    expect(validateDraft({ ...draft, steps: [] })).not.toBeNull()
    expect(validateDraft({ ...draft, enabled: false, steps: [] })).toBeNull()
  })

  it('drops empty placeholder ingredients on save', () => {
    const withBlank = structuredClone(draft)
    withBlank.steps[0].options.push({ id: 'x', name: '  ', desc: '', priceModifier: '', ingredients: [], isActive: true })
    expect(cleanDraft(withBlank).steps[0].options).toHaveLength(1)
  })
})

describe('"Solo si…" conditions', () => {
  const withRules = () => {
    const d = draftFromDocs(CONFIG, RECIPE)
    d.steps[1].options[1].showIf = { base: ['leche'] }       // B only with Leche
    d.steps[2].showIf = { sabor: ['a', 'gone'] }              // Perlas only with A
    return d
  }

  it('round-trips rules and drops references to options that no longer exist', () => {
    const config = configFromDraft(withRules())
    expect(config.steps[1].options[1].showIf).toEqual({ base: ['leche'] })
    expect(config.steps[2].showIf).toEqual({ sabor: ['a'] })
    expect(config.steps[0]).not.toHaveProperty('showIf')
    expect(draftFromDocs(config, RECIPE).steps[2].showIf).toEqual({ sabor: ['a'] })
    expect(draftFromDocs(CONFIG, RECIPE).steps[0].showIf).toEqual({})
  })

  it('describes and toggles a rule', () => {
    const d = withRules()
    expect(describeCondition({ base: ['leche'], sabor: ['a', 'c'] }, d.steps)).toBe('Leche y (A o C)')
    expect(describeCondition({ sabor: ['a', 'c'] }, d.steps)).toBe('A o C')
    expect(toggleCondition({ base: ['leche'] }, 'base', 'leche')).toEqual({})
    expect(toggleCondition({}, 'sabor', 'b')).toEqual({ sabor: ['b'] })
  })

  it('blocks saving when a rule points at a step that now comes later', () => {
    const d = withRules()
    ;[d.steps[1], d.steps[2]] = [d.steps[2], d.steps[1]]     // Perlas now before Sabor
    expect(validateDraft(d)).toMatchObject({ stepIndex: 1 })
    expect(validateDraft(withRules())).toBeNull()
  })

  it('a conditional required step can be skipped, so it adds nothing to the cheapest drink', () => {
    const d = withRules()
    d.steps[2].required = true
    expect(drinkRanges(d, MATERIALS)).toMatchObject({ minPrice: 50, maxPrice: 75 })
  })
})
