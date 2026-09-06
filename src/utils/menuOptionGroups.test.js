import { describe, expect, it } from 'vitest'
import {
  addOptionToGroup,
  removeOptionFromGroup,
  updateOptionGroup,
  updateOptionInGroup,
} from './menuOptionGroups'

describe('menu option group helpers', () => {
  const groups = [{ id: 'size', name: 'Tamaño', type: 'single', required: true, options: [{ id: 'small', name: 'Chico', priceModifier: 0 }] }]

  it('updates groups and options immutably', () => {
    const renamed = updateOptionGroup(groups, 0, 'name', 'Tamaño de bebida')
    const priced = updateOptionInGroup(renamed, 0, 0, 'priceModifier', 5)
    expect(priced[0].name).toBe('Tamaño de bebida')
    expect(priced[0].options[0].priceModifier).toBe(5)
    expect(groups[0].options[0].priceModifier).toBe(0)
  })

  it('adds and removes options without changing other groups', () => {
    const withOption = addOptionToGroup(groups, 0, { id: 'large', name: 'Grande', priceModifier: 10 })
    expect(withOption[0].options).toHaveLength(2)
    expect(removeOptionFromGroup(withOption, 0, 0)[0].options).toEqual([{ id: 'large', name: 'Grande', priceModifier: 10 }])
  })
})
