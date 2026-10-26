import { describe, expect, it } from 'vitest'
import { isStaleWhatsAppSnapshot } from './orderCleanup'

const NOW = new Date(2026, 9, 26, 12)
const daysAgo = (n) => ({ toDate: () => new Date(NOW - n * 86400000) })

describe('isStaleWhatsAppSnapshot', () => {
  it('removes old WhatsApp snapshots nobody acted on, or that were discarded', () => {
    expect(isStaleWhatsAppSnapshot({ source: 'whatsapp', reviewed: false, createdAt: daysAgo(4) }, NOW)).toBe(true)
    expect(isStaleWhatsAppSnapshot({ source: 'whatsapp', reviewed: true, discarded: true, createdAt: daysAgo(5) }, NOW)).toBe(true)
  })

  it('keeps recent ones', () => {
    expect(isStaleWhatsAppSnapshot({ source: 'whatsapp', createdAt: daysAgo(1) }, NOW)).toBe(false)
  })

  it('never removes an order someone worked on, or any non-WhatsApp order', () => {
    const old = { source: 'whatsapp', createdAt: daysAgo(30) }
    expect(isStaleWhatsAppSnapshot({ ...old, status: 'Pagado', paidAt: daysAgo(30) }, NOW)).toBe(false)
    expect(isStaleWhatsAppSnapshot({ ...old, status: 'Preparando' }, NOW)).toBe(false)
    expect(isStaleWhatsAppSnapshot({ ...old, sentToKitchen: true }, NOW)).toBe(false)
    expect(isStaleWhatsAppSnapshot({ ...old, completedAt: daysAgo(30) }, NOW)).toBe(false)
    expect(isStaleWhatsAppSnapshot({ source: 'pos', createdAt: daysAgo(30) }, NOW)).toBe(false)
    expect(isStaleWhatsAppSnapshot({ source: 'whatsapp' }, NOW)).toBe(false)
  })
})
