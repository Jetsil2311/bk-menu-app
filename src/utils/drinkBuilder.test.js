import { describe, expect, it } from 'vitest'
import {
  buildCartItem,
  computeTotal,
  deriveCupVisual,
  firstIncompleteStep,
  nameFromItem,
  normalizeBuilderConfig,
  randomSelections,
  resolveBuilder,
  selectionsFromItem,
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

describe('editing a line', () => {
  const c = normalizeBuilderConfig(RAW)

  it('rebuilds selections and name from a cart item, skipping removed choices', () => {
    const s = { base: ['b'], flavor: ['x', 'z'], pearls: ['p'] }
    const item = buildCartItem(c, s, 'La de Ana')
    expect(selectionsFromItem(c, item)).toEqual(s)
    expect(nameFromItem(c, item)).toBe('La de Ana')
    expect(nameFromItem(c, buildCartItem(c, s))).toBe('')
    const stale = { ...item, selectedOptions: [...item.selectedOptions, { groupId: 'flavor', optionId: 'gone' }] }
    expect(selectionsFromItem(c, stale)).toEqual(s)
  })
})

describe('"Solo si…" conditions', () => {
  const c = normalizeBuilderConfig({
    enabled: true,
    basePrice: 50,
    steps: [
      { id: 'base', name: 'Base', type: 'single', required: true,
        options: [{ id: 'leche', name: 'Leche' }, { id: 'agua', name: 'Agua' }] },
      { id: 'sabor', name: 'Sabor', type: 'multi', required: true,
        options: [
          { id: 'taro', name: 'Taro', priceModifier: 5, showIf: { base: ['leche'] } },
          { id: 'mango', name: 'Mango' },
        ] },
      { id: 'temp', name: 'Temperatura', type: 'single', required: true,
        options: [{ id: 'frio', name: 'Frío' }, { id: 'caliente', name: 'Caliente' }] },
      { id: 'hielo', name: 'Hielo', type: 'single', required: true, visual: 'ice', showIf: { temp: ['frio'] },
        options: [{ id: 'normal', name: 'Normal' }, { id: 'poco', name: 'Poco', amount: 0.5 }] },
      // Needs taro AND a cold drink.
      { id: 'toque', name: 'Toque', type: 'single', showIf: { sabor: ['taro'], temp: ['frio'] },
        options: [{ id: 'cloud', name: 'Cloud', priceModifier: 15 }] },
    ],
  })
  const stepIds = (s) => resolveBuilder(c, s).config.steps.map((st) => st.id)

  it('hides an ingredient until its condition is picked', () => {
    const sabor = (s) => resolveBuilder(c, s).config.steps.find((st) => st.id === 'sabor').options.map((o) => o.id)
    expect(sabor({ base: ['agua'] })).toEqual(['mango'])
    expect(sabor({ base: ['leche'] })).toEqual(['taro', 'mango'])
    expect(sabor({})).toEqual(['mango'])
  })

  it('skips a step whose condition is not met, so a hot drink never asks for ice', () => {
    expect(stepIds({ temp: ['caliente'] })).toEqual(['base', 'sabor', 'temp'])
    expect(stepIds({ temp: ['frio'] })).toEqual(['base', 'sabor', 'temp', 'hielo'])
    const hot = resolveBuilder(c, { base: ['agua'], sabor: ['mango'], temp: ['caliente'] })
    expect(firstIncompleteStep(hot.config, hot.selections)).toBe(-1)
  })

  it('needs one option of EVERY listed step', () => {
    expect(stepIds({ base: ['leche'], sabor: ['taro'], temp: ['caliente'] })).not.toContain('toque')
    expect(stepIds({ base: ['leche'], sabor: ['taro'], temp: ['frio'] })).toContain('toque')
  })

  it('drops picks that stop applying, in cascade', () => {
    const before = { base: ['leche'], sabor: ['taro', 'mango'], temp: ['frio'], hielo: ['poco'], toque: ['cloud'] }
    expect(resolveBuilder(c, before).selections).toEqual(before)
    // Switching to water removes taro, and with it the taro-only topping.
    const after = resolveBuilder(c, { ...before, base: ['agua'] })
    expect(after.selections).toEqual({ base: ['agua'], sabor: ['mango'], temp: ['frio'], hielo: ['poco'] })
    expect(computeTotal(after.config, after.selections)).toBe(50)
  })

  it('random drinks follow the rules', () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSelections(c)
      const r = resolveBuilder(c, s)
      expect(r.selections).toEqual(Object.fromEntries(Object.entries(s).filter(([, ids]) => ids.length)))
      expect(firstIncompleteStep(r.config, r.selections)).toBe(-1)
    }
  })

  it('editing a ticket line drops choices the rules no longer allow', () => {
    const item = { selectedOptions: [
      { groupId: 'base', optionId: 'agua' }, { groupId: 'sabor', optionId: 'taro' },
      { groupId: 'temp', optionId: 'caliente' }, { groupId: 'hielo', optionId: 'normal' },
    ] }
    expect(selectionsFromItem(c, item)).toEqual({ base: ['agua'], temp: ['caliente'] })
  })

  it('ignores malformed rules', () => {
    const n = normalizeBuilderConfig({ enabled: true, steps: [
      { id: 'a', name: 'A', showIf: ['x'], options: [{ id: '1', name: 'Uno', showIf: { a: [] } }] },
    ] })
    expect(n.steps[0].showIf).toBeNull()
    expect(n.steps[0].options[0].showIf).toBeNull()
  })
})
