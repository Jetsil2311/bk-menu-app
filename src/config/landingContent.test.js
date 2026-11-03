import { describe, it, expect } from 'vitest'
import { DEFAULT_LANDING, mergeLanding, setPath, getPath } from './landingContent'
import { daysLabel, closedDaysLabel, openStatus, isClosedOn } from './business'

const HOURS = { days: [3, 4, 5, 6, 0, 1], open: '11:30', close: '20:30' }
// 2026-11-03 is a Tuesday (closed day), 2026-11-04 a Wednesday.
const WED_NOON = new Date(2026, 10, 4, 12, 0)

describe('landing content', () => {
  it('uses the defaults for anything not saved yet', () => {
    expect(mergeLanding(null)).toEqual(DEFAULT_LANDING)
    const merged = mergeLanding({ hero: { text: 'Hola' } })
    expect(merged.hero.text).toBe('Hola')
    expect(merged.hero.ctaMenu).toBe(DEFAULT_LANDING.hero.ctaMenu)
  })

  it('ignores saved values of the wrong type', () => {
    const merged = mergeLanding({ hero: { text: 42, products: 'x' }, ticker: 'Boba' })
    expect(merged.hero.text).toBe(DEFAULT_LANDING.hero.text)
    expect(merged.hero.products).toBeNull()
    expect(merged.ticker).toEqual(DEFAULT_LANDING.ticker)
  })

  it('keeps the three order steps even if fewer were saved', () => {
    const merged = mergeLanding({ order: { steps: [{ title: 'Escoge' }] } })
    expect(merged.order.steps).toHaveLength(3)
    expect(merged.order.steps[0]).toEqual({ title: 'Escoge', text: DEFAULT_LANDING.order.steps[0].text })
  })

  it('sets nested values and list items without touching the rest', () => {
    const next = setPath(DEFAULT_LANDING, 'ticker.1', 'Té')
    expect(next.ticker[1]).toBe('Té')
    expect(DEFAULT_LANDING.ticker[1]).toBe('Café')
    expect(getPath(setPath(DEFAULT_LANDING, 'order.steps.2.title', 'Manda'), 'order.steps.2.title')).toBe('Manda')
  })
})

describe('opening hours', () => {
  it('describes the days like a person would', () => {
    expect(daysLabel(HOURS.days)).toBe('Miércoles a lunes')
    expect(closedDaysLabel(HOURS.days)).toBe('Martes')
    expect(daysLabel([1, 3, 5])).toBe('Lunes, miércoles y viernes')
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Todos los días')
  })

  it('is open during hours', () => {
    expect(openStatus(WED_NOON, HOURS).open).toBe(true)
  })

  it('"Cerrado hoy" closes the day and says when we come back', () => {
    const closure = { until: '2026-11-04', message: '' }
    expect(isClosedOn(closure, WED_NOON)).toBe(true)
    const status = openStatus(WED_NOON, HOURS, closure)
    expect(status.open).toBe(false)
    expect(status.closedToday).toBe(true)
    expect(status.text).toBe('Hoy no abrimos · volvemos mañana a las 11:30 a. m.')
  })

  it('"Cerrado hoy" ends by itself the next day', () => {
    const closure = { until: '2026-11-04', message: '' }
    expect(openStatus(new Date(2026, 10, 5, 12, 0), HOURS, closure).open).toBe(true)
  })

  it('skips the weekly rest day when coming back', () => {
    // Closed Monday → Tuesday is the rest day → back on Wednesday.
    const monday = new Date(2026, 10, 2, 12, 0)
    expect(openStatus(monday, HOURS, { until: '2026-11-02' }).text).toBe('Hoy no abrimos · volvemos el miércoles a las 11:30 a. m.')
  })
})
