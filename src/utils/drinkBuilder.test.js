import { describe, expect, it } from 'vitest'
import {
  buildCartItem,
  computeTotal,
  deriveCupVisual,
  firstIncompleteStep,
  normalizeBuilderConfig,
  randomSelections,
  suggestName,
  toggleSelection,
} from './drinkBuilder'

// Made-up fixture — real ingredients come from settings/drinkBuilder.
const RAW = {
  enabled: true,
  basePrice: 50,
  steps: [
    { id: 'base', name: 'Base', type: 'single', required: true, visual: 'liquid',
      options: [{ id: 'a', name: 'Base A', color: '#fff' }, { id: 'b', name: 'Base B', priceModifier: 5 }] },
    { id: 'flavor', name: 'Sabor', type: 'multi', maxSelections: 2, required: true, visual: 'liquid',
      options: [{ id: 'x', name: 'X', color: '#f00' }, { id: 'y', name: 'Y' }, { id: 'z', name: 'Z', priceModifier: 10 }] },
    { id: 'pearls', name: 'Perlas', type: 'single', visual: 'pearls',
      options: [{ id: 'p', name: 'P', priceModifier: 10 }, { id: 'off', name: 'Off', isActive: false }] },
    { id: 'empty', name: 'Vacío', options: [] },
  ],
}

describe('normalizeBuilderConfig', () => {
  it('returns null when disabled or empty', () => {
    expect(normalizeBuilderConfig(null)).toBeNull()
    expect(normalizeBuilderConfig({ ...RAW, enabled: false })).toBeNull()
    expect(normalizeBuilderConfig({ enabled: true, steps: [{ id: 's', options: [] }] })).toBeNull()
  })

  it('drops empty steps and inactive options, fills defaults', () => {
    const c = normalizeBuilderConfig(RAW)
    expect(c.steps.map((s) => s.id)).toEqual(['base', 'flavor', 'pearls'])
    expect(c.steps[2].options.map((o) => o.id)).toEqual(['p'])
    expect(c.title).toBe('Arma tu bebida')
    expect(c.steps[1].maxSelections).toBe(2)
    expect(c.steps[0].maxSelections).toBeNull()
  })
})

describe('selections and price', () => {
  const c = normalizeBuilderConfig(RAW)
  const [base, flavor, pearls] = c.steps

  it('single steps replace; required ones cannot be cleared by re-tapping', () => {
    let s = toggleSelection({}, base, 'a')
    s = toggleSelection(s, base, 'b')
    expect(s.base).toEqual(['b'])
    expect(toggleSelection(s, base, 'b').base).toEqual(['b'])
    const p = toggleSelection({}, pearls, 'p')
    expect(toggleSelection(p, pearls, 'p').pearls).toEqual([])
  })

  it('multi steps respect the limit by dropping the oldest choice', () => {
    let s = toggleSelection({}, flavor, 'x')
    s = toggleSelection(s, flavor, 'y')
    s = toggleSelection(s, flavor, 'z')
    expect(s.flavor).toEqual(['y', 'z'])
    expect(toggleSelection(s, flavor, 'y').flavor).toEqual(['z'])
  })

  it('total = base price + every chosen modifier', () => {
    const s = { base: ['b'], flavor: ['x', 'z'], pearls: ['p'] }
    expect(computeTotal(c, s)).toBe(50 + 5 + 10 + 10)
  })

  it('finds the first unfinished required step', () => {
    expect(firstIncompleteStep(c, {})).toBe(0)
    expect(firstIncompleteStep(c, { base: ['a'] })).toBe(1)
    expect(firstIncompleteStep(c, { base: ['a'], flavor: ['x'] })).toBe(-1)
  })
})

describe('cup visual, random drink, names and cart item', () => {
  const c = normalizeBuilderConfig(RAW)
  const s = { base: ['a'], flavor: ['x'], pearls: ['p'] }

  it('maps steps to cup layers', () => {
    const v = deriveCupVisual(c, s)
    expect(v.liquids.map((l) => l.color)).toEqual(['#fff', '#f00'])
    expect(v.pearls).toHaveLength(1)
    expect(v.foam).toBeNull()
  })

  it('random drinks always complete the required steps', () => {
    for (let i = 0; i < 25; i++) {
      expect(firstIncompleteStep(c, randomSelections(c))).toBe(-1)
    }
  })

  it('suggests a name from the last liquid', () => {
    expect(suggestName(c, s, () => 0)).toBe('Nube de X')
    expect(suggestName(c, {}, () => 0)).toBe('')
  })

  it('builds a cart line the cart, POS and kitchen understand', () => {
    const item = buildCartItem(c, s, '  Mi bebida  ')
    expect(item).toMatchObject({ id: 'arma-tu-bebida', name: 'Arma tu bebida: Mi bebida', price: 50 })
    expect(item.selectedOptions.map((o) => [o.groupId, o.optionId, o.priceModifier])).toEqual([
      ['base', 'a', 0], ['flavor', 'x', 0], ['pearls', 'p', 10],
    ])
    expect(buildCartItem(c, s).name).toBe('Arma tu bebida')
  })
})
