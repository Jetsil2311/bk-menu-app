// Every WhatsApp checkout on the menu saves an order snapshot, even when the
// customer never actually sends the message. These used to disappear because
// the menu trimmed `orders` to the newest 50 documents — which also deleted
// paid sales history. Now nothing paid is ever deleted: only snapshots nobody
// acted on (or that a cashier discarded) are removed once they're a few days
// old. The admin panel does this, signed in, instead of the customer's phone.

export const STALE_SNAPSHOT_DAYS = 3

const toDate = (v) => (v instanceof Date ? v : v?.toDate?.() ?? null)

export const isStaleWhatsAppSnapshot = (order, now = new Date()) => {
  if (order?.source !== 'whatsapp') return false
  // Anything someone worked on stays: a status (Pedidos / Cobrar), kitchen,
  // payment, refund.
  if (order.status || order.sentToKitchen || order.paidAt || order.completedAt || order.refundedAt) return false
  const created = toDate(order.createdAt)
  if (!created) return false
  return now - created > STALE_SNAPSHOT_DAYS * 86400000
}
