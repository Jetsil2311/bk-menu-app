export const createTodayKey = (date = new Date()) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')

export const createLocalId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const normalizeSearchText = (value) =>
  (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export const getItemLineTotal = (item) =>
  (Number(item.price || 0)
    + (item.selectedOptions || []).reduce((total, option) => total + Number(option.priceModifier || 0), 0)
    + (item.selectedToppings || []).reduce((total, topping) => total + Number(topping.price || 0), 0)
  ) * (item.qty || 0)

export const getOrderTotal = (items = []) =>
  items.reduce((total, item) => total + getItemLineTotal(item), 0)

// Normalizes ticket line items into the shape persisted to Firestore
// (orders.items / parked docs before them) — nulls coalesced, numbers
// coerced. Shared by every write path that saves the active ticket
// (send-to-kitchen, direct charge, WhatsApp review).
export const toSafeItems = (orderItems = []) =>
  orderItems.map((it) => ({
    id: it.id ?? null,
    productDocId: it.productDocId ?? null,
    name: it.name ?? '',
    price: Number(it.price || 0),
    imageUrl: it.imageUrl ?? null,
    qty: it.qty ?? 1,
    itemNote: it.itemNote || null,
    cartItemId: it.cartItemId ?? null,
    stationTags: Array.isArray(it.stationTags) ? it.stationTags : [],
    selectedOptions: (it.selectedOptions ?? []).map((o) => ({
      groupId: o.groupId ?? null,
      optionId: o.optionId ?? null,
      optionName: o.optionName ?? '',
      priceModifier: Number(o.priceModifier || 0),
    })),
    selectedToppings: (it.selectedToppings ?? []).map((t) => ({
      id: t.id ?? null, name: t.name ?? '', price: Number(t.price || 0),
    })),
  }))
