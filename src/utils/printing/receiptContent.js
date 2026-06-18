// Shared receipt content builder — both USB and Windows paths consume this.
// Maps actual Firestore order field names to a normalized content object.
// Field names confirmed from POS.jsx handlePayment: orderId, items[].qty,
// items[].price, items[].selectedOptions[], items[].itemNote, generalNote,
// paymentMethods.{cash,card,loyalty}, loyaltyEarned, loyaltyRedeemed.

const toDate = (ts) => {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts.toDate === 'function') return ts.toDate()
  return new Date()
}

export const buildReceiptContent = (order, settings) => {
  const pm              = order.paymentMethods || {}
  const cash            = Number(pm.cash    || 0)
  const card            = Number(pm.card    || 0)
  const loyaltyPaid     = Number(pm.loyalty || 0)
  const total           = Number(order.total || 0)
  const loyaltyRedeemed = Number(order.loyaltyRedeemed || 0)
  const subtotal        = total + loyaltyRedeemed
  const safeTotal      = isNaN(total) ? 0 : total
  const subtotalSinIva = Math.round((safeTotal / 1.16) * 100) / 100
  const ivaAmount      = Math.round((safeTotal - subtotalSinIva) * 100) / 100
  const ivaCheck       = Math.round((subtotalSinIva + ivaAmount) * 100) / 100
  const iva            = Math.round((ivaAmount + (safeTotal - ivaCheck)) * 100) / 100

  let paymentMethod = 'card'
  if (cash > 0 && cash >= card && cash >= loyaltyPaid)
    paymentMethod = 'cash'
  else if (loyaltyPaid > 0 && loyaltyPaid >= cash && loyaltyPaid >= card)
    paymentMethod = 'loyalty'

  const change       = paymentMethod === 'cash'
    ? Math.max(0, cash + card + loyaltyPaid - total)
    : null
  const cashReceived = cash > 0 ? cash : null

  let loyaltyInfo = null
  const earned = Number(order.loyaltyEarned || 0)
  if (earned > 0 || loyaltyRedeemed > 0) {
    const parts = []
    if (loyaltyRedeemed > 0) parts.push(`Redimido: $${loyaltyRedeemed.toFixed(2)}`)
    if (earned          > 0) parts.push(`Ganado: $${earned.toFixed(2)}`)
    loyaltyInfo = parts.join(' · ')
  }

  return {
    businessName:  settings?.receiptBusinessName  || 'Bubble Kaapeh',
    orderId:       order.orderId || order.id,
    timestamp:     toDate(order.createdAt),
    items: (order.items || []).map(item => {
      const optionsMod    = (item.selectedOptions  || []).reduce((s, o) => s + Number(o.priceModifier || 0), 0)
      const unitPrice     = Number(item.price || 0) + optionsMod
      const toppingsTotal = (item.selectedToppings || []).reduce((s, t) => s + Number(t.price || 0), 0)
      const qty           = item.qty || 1
      return {
        name:      item.name,
        quantity:  qty,
        unitPrice,
        options:   item.selectedOptions?.length
          ? { Opciones: item.selectedOptions.map(o => o.optionName).join(', ') }
          : null,
        toppings:  (item.selectedToppings || []).map(t => ({
          name:  t.name,
          price: Number(t.price || 0),
        })),
        note:       item.itemNote || null,
        totalPrice: (unitPrice + toppingsTotal) * qty,
      }
    }),
    subtotal,
    subtotalSinIva,
    iva,
    discount:      loyaltyRedeemed,
    total,
    paymentMethod,
    cashReceived,
    change,
    customerName:  order.customerName  || null,
    loyaltyInfo,
    orderNote:     order.generalNote   || null,
    footerMessage: settings?.receiptFooterMessage || '¡Gracias por tu visita!',
  }
}

// Comanda content — items, options, notes only. No prices or payment info.
export const buildCommandaContent = (order) => ({
  orderId:   order.orderId || order.id,
  timestamp: toDate(order.createdAt ?? order.parkedAt),
  items: (order.items || []).map(item => ({
    name:     item.name,
    quantity: item.qty || 1,
    options:  item.selectedOptions?.length
      ? { Opciones: item.selectedOptions.map(o => o.optionName).join(', ') }
      : null,
    toppings: (item.selectedToppings || []).map(t => ({ name: t.name })),
    note:     item.itemNote || null,
  })),
  orderNote: order.generalNote || null,
})
