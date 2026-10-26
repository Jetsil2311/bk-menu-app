// Orders placed from the public menu ("Pedir por WhatsApp").
//
// The customer's cart is saved as a structured order in its own collection,
// `web_orders` — never in `orders`, which only holds tickets the café has
// actually taken (POS / kitchen / paid). A web order waits as 'pending' until
// a cashier imports it into Cobrar or ignores it:
//
//   web_orders/{auto id} = {
//     orderId: 'WEB-…',           short code shown to staff and in the WhatsApp text
//     items: [...],               same shape as orders.items (toSafeItems)
//     total: number,
//     generalNote: string | null,
//     status: 'pending' | 'imported' | 'dismissed',
//     createdAt, updatedAt,       serverTimestamp()
//     importedAt?, dismissedAt?   set by the admin side
//   }
//
// Nothing here parses text: the admin imports `items` as-is.
import { getOrderTotal, toSafeItems } from './posCalculations.js'

export const WEB_ORDERS_COLLECTION = 'web_orders'

export const WEB_ORDER_STATUS = {
  pending: 'pending',
  imported: 'imported',
  dismissed: 'dismissed',
}

// Firestore rules cap the item count; keep the client in sync with them.
export const WEB_ORDER_MAX_ITEMS = 60

export const newWebOrderCode = (now = Date.now(), rand = Math.random) =>
  `WEB-${now.toString(36).toUpperCase().slice(-5)}${rand().toString(36).slice(2, 4).toUpperCase()}`

// Builds the document the menu writes. `items` keep every option/topping
// so the POS can load them without re-asking the customer.
export const buildWebOrder = (cart = [], notes = '', orderId = newWebOrderCode()) => {
  const items = toSafeItems(cart).slice(0, WEB_ORDER_MAX_ITEMS)
  return {
    orderId,
    items,
    total: Number(getOrderTotal(items).toFixed(2)),
    generalNote: (notes || '').trim().slice(0, 500) || null,
    status: WEB_ORDER_STATUS.pending,
  }
}

// "2× Taro, Latte, Matcha…" — one line for lists and notifications.
export const webOrderPreview = (order, max = 3) => {
  const items = order?.items || []
  const names = items.slice(0, max).map((it) => `${(it.qty || 1) > 1 ? `${it.qty}× ` : ''}${it.name}`)
  const rest = items.length - max
  return names.join(', ') + (rest > 0 ? ` y ${rest} más` : '')
}

export const webOrderItemCount = (order) =>
  (order?.items || []).reduce((n, it) => n + (Number(it.qty) || 1), 0)

export const timeAgo = (date, now = Date.now()) => {
  if (!date) return 'Ahora'
  const min = Math.floor((now - date.getTime()) / 60000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`
}
