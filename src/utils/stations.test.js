import { describe, expect, it } from 'vitest'
import { stationsForItem, deriveGroupStatus, isOrderFullyDone } from './stations'

const kitchen = { id: 'cocina', role: 'kitchen', productTags: ['bebidas'] }
const kitchenUntagged = { id: 'cocina2', role: 'kitchen', productTags: [] }
const cajero = { id: 'cajero', role: 'cajero', productTags: ['bebidas'] }
const cajeroUntagged = { id: 'cajero2', role: 'cajero', productTags: [] }

describe('stationsForItem', () => {
  it('routes an untagged product to every kitchen station, not cajero', () => {
    const item = { id: 'p1', stationTags: [] }
    const stations = [kitchen, cajero]
    expect(stationsForItem(item, stations)).toEqual([kitchen])
  })

  it('routes a tagged product only to stations sharing that tag', () => {
    const item = { id: 'p1', stationTags: ['bebidas'] }
    const stations = [kitchen, cajero]
    const result = stationsForItem(item, stations)
    expect(result.map(s => s.id).sort()).toEqual(['cajero', 'cocina'])
  })

  it('an untagged station catches every product, tagged or not', () => {
    const stations = [kitchenUntagged, cajero]
    expect(stationsForItem({ id: 'p1', stationTags: [] }, stations).map(s => s.id)).toContain('cocina2')
    expect(stationsForItem({ id: 'p2', stationTags: ['postres'] }, stations).map(s => s.id)).toContain('cocina2')
  })

  it('does not route an untagged product to a tagged non-kitchen station', () => {
    const item = { id: 'p1', stationTags: [] }
    const stations = [cajero]
    expect(stationsForItem(item, stations)).toEqual([])
  })

  it('does not match a genuinely mismatched tag', () => {
    const item = { id: 'p1', stationTags: ['postres'] }
    const stations = [kitchen, cajero]
    expect(stationsForItem(item, stations)).toEqual([])
  })

  it('prefers the product doc tags over whatever is stamped on the item', () => {
    const item = { id: 'p1', productDocId: 'doc1', stationTags: ['postres'] }
    const productsById = { doc1: { stationTags: ['bebidas'] } }
    const stations = [kitchen, cajeroUntagged]
    const result = stationsForItem(item, stations, productsById).map(s => s.id).sort()
    expect(result).toEqual(['cajero2', 'cocina'])
  })
})

describe('deriveGroupStatus / isOrderFullyDone', () => {
  it('derives pending/preparando/listo from item statuses', () => {
    expect(deriveGroupStatus([])).toBe('pending')
    expect(deriveGroupStatus([{ itemStatus: 'pending' }])).toBe('pending')
    expect(deriveGroupStatus([{ itemStatus: 'pending' }, { itemStatus: 'preparando' }])).toBe('preparando')
    expect(deriveGroupStatus([{ itemStatus: 'listo' }, { itemStatus: 'listo' }])).toBe('listo')
  })

  it('an order is fully done only when every station reports listo', () => {
    expect(isOrderFullyDone({ stationItems: {} })).toBe(false)
    expect(isOrderFullyDone({ stationItems: { a: { status: 'listo' }, b: { status: 'preparando' } } })).toBe(false)
    expect(isOrderFullyDone({ stationItems: { a: { status: 'listo' }, b: { status: 'listo' } } })).toBe(true)
  })
})
