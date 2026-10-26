// "Today" numbers for Inicio, on the same basis as Caja: only orders that
// were actually PAID count, on the day they were paid. Orders still waiting
// (WhatsApp orders not charged yet, tabs en curso), cancelled, refunded or
// discarded ones don't. Caja adds each charge's total (cash + card + loyalty)
// when it's charged and subtracts it on refund, so both screens agree.
import { isPaidOrderStatus } from './orderStatus.js'

const toDate = (v) => {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === 'function') return v.toDate()
  return null
}

// When the money came in: paidAt (Cobrar), completedAt (older orders marked
// paid in Pedidos), else when it was created.
export const paidTimeOf = (order) => toDate(order.paidAt) ?? toDate(order.completedAt) ?? toDate(order.createdAt)

const CLOSED = new Set(['pagado', 'entregado', 'reembolsado', 'cancelado'])

export const isPendingOrder = (order) =>
  !order.discarded && !CLOSED.has(String(order.status || '').toLowerCase())

export const summarizeDailySales = (orders, now = new Date()) => {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  // "Comparado con ayer a esta hora"
  const sameTimeYesterday = new Date(startYesterday.getTime() + (now - startToday))

  let ordersToday = 0, revenueToday = 0, prevOrdersToday = 0, prevRevenueToday = 0, pendingToday = 0
  for (const order of orders) {
    if (isPaidOrderStatus(order.status)) {
      const paid = paidTimeOf(order)
      if (!paid) continue
      const total = Number(order.total || 0)
      if (paid >= startToday && paid <= now) { ordersToday++; revenueToday += total }
      else if (paid >= startYesterday && paid <= sameTimeYesterday) { prevOrdersToday++; prevRevenueToday += total }
    } else if (isPendingOrder(order)) {
      const created = toDate(order.createdAt)
      if (created && created >= startToday) pendingToday++
    }
  }
  const round = (n) => Math.round(n * 100) / 100
  return {
    ordersToday,
    revenueToday: round(revenueToday),
    avgTicket: ordersToday ? round(revenueToday / ordersToday) : 0,
    prevOrdersToday,
    prevRevenueToday: round(prevRevenueToday),
    prevAvgTicket: prevOrdersToday ? round(prevRevenueToday / prevOrdersToday) : 0,
    pendingToday,
  }
}
