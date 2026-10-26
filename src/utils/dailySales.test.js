import { describe, expect, it } from 'vitest'
import { summarizeDailySales } from './dailySales'

// 2026-10-26 20:10 local time
const NOW = new Date(2026, 9, 26, 20, 10)
const at = (day, h, m = 0) => new Date(2026, 9, day, h, m)
// Same shape Firestore gives back (Timestamp-like).
const ts = (d) => ({ toDate: () => d })

describe('summarizeDailySales', () => {
  it('counts only paid orders, on the day they were paid — like Caja', () => {
    const orders = [
      { status: 'Pagado', total: 425, createdAt: ts(at(26, 9)), paidAt: ts(at(26, 9)) },
      { status: 'Pagado', total: 660, createdAt: ts(at(26, 12)), paidAt: ts(at(26, 12)) },
      // Old WhatsApp text snapshots (no status) — not tickets; pending menu
      // orders now live in web_orders.
      { source: 'whatsapp', total: 200, createdAt: ts(at(26, 13)) },
      { source: 'whatsapp', total: 240, createdAt: ts(at(26, 14)) },
      { source: 'whatsapp', total: 200, createdAt: ts(at(26, 15)), reviewed: true, discarded: true },
      { status: 'Preparando', total: 90, createdAt: ts(at(26, 16)), sentToKitchen: true },
      { status: 'Cancelado', total: 50, createdAt: ts(at(26, 10)) },
      { status: 'Reembolsado', total: 70, createdAt: ts(at(26, 11)), paidAt: ts(at(26, 11)) },
    ]
    const s = summarizeDailySales(orders, NOW)
    expect(s).toMatchObject({ ordersToday: 2, revenueToday: 1085, avgTicket: 542.5, pendingToday: 1 })
  })

  it('a tab opened yesterday and paid today counts today', () => {
    const s = summarizeDailySales([
      { status: 'Pagado', total: 100, createdAt: ts(at(25, 21)), paidAt: ts(at(26, 8)) },
    ], NOW)
    expect(s.ordersToday).toBe(1)
    expect(s.prevOrdersToday).toBe(0)
  })

  it('compares with yesterday up to this same time', () => {
    const s = summarizeDailySales([
      { status: 'Pagado', total: 100, paidAt: ts(at(25, 19)) },
      { status: 'Pagado', total: 300, paidAt: ts(at(25, 21)) },   // later than 20:10 → not yet
      { status: 'Pagado', total: 999, paidAt: ts(at(24, 12)) },   // two days ago
    ], NOW)
    expect(s).toMatchObject({ prevOrdersToday: 1, prevRevenueToday: 100, prevAvgTicket: 100, ordersToday: 0 })
  })

  it('falls back to completedAt, then createdAt, for older paid orders', () => {
    const s = summarizeDailySales([
      { status: 'Pagado', total: 10, createdAt: ts(at(25, 9)), completedAt: ts(at(26, 9)) },
      { status: 'entregado', total: 20, createdAt: ts(at(26, 9)) },
    ], NOW)
    expect(s).toMatchObject({ ordersToday: 2, revenueToday: 30 })
  })
})
