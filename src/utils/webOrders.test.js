import { describe, expect, it } from 'vitest'
import { buildWebOrder, newWebOrderCode, webOrderItemCount, webOrderPreview } from './webOrders'

const CART = [
  {
    id: 7, name: 'Taro', price: 60, qty: 2, cartItemId: 'c1',
    selectedOptions: [{ groupId: 'tam', optionId: 'g', optionName: 'Grande', priceModifier: 10 }],
    selectedToppings: [{ id: 't1', name: 'Tapioca', price: 10 }],
    availableToppings: [{ id: 't1' }], // UI-only field, must not be saved
  },
  { id: 9, name: 'Latte', price: 45, qty: 1 },
]

describe('buildWebOrder', () => {
  it('saves the cart as structured items with options and toppings', () => {
    const order = buildWebOrder(CART, '  sin popote  ', 'WEB-TEST')
    expect(order).toMatchObject({ orderId: 'WEB-TEST', status: 'pending', generalNote: 'sin popote' })
    expect(order.items[0]).toMatchObject({
      name: 'Taro', price: 60, qty: 2,
      selectedOptions: [{ groupId: 'tam', optionId: 'g', optionName: 'Grande', priceModifier: 10 }],
      selectedToppings: [{ id: 't1', name: 'Tapioca', price: 10 }],
    })
    expect(order.items[0]).not.toHaveProperty('availableToppings')
  })

  it('totals base + options + toppings per unit', () => {
    expect(buildWebOrder(CART).total).toBe((60 + 10 + 10) * 2 + 45)
  })

  it('stores an empty note as null', () => {
    expect(buildWebOrder(CART, '   ').generalNote).toBeNull()
  })
})

describe('labels', () => {
  it('summarises items for notifications', () => {
    expect(webOrderPreview({ items: buildWebOrder(CART).items })).toBe('2× Taro, Latte')
    expect(webOrderItemCount({ items: buildWebOrder(CART).items })).toBe(3)
  })

  it('makes short readable codes', () => {
    expect(newWebOrderCode(1_700_000_000_000, () => 0.5)).toMatch(/^WEB-[0-9A-Z]{5,7}$/)
  })
})
