import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { ShieldCheck, CreditCard, ChefHat } from 'lucide-react'
import { db } from '../firebase'
import { ADMIN_PIN } from '../config/adminPin'

// Reused across every station-aware view. Keep in sync with the routes
// declared in src/main.jsx.
export const ROUTE_KEYS = [
  'overview', 'pos', 'pedidos', 'clientes', 'stock',
  'finanzas', 'metricas', 'promociones', 'menu', 'caja', 'legacy', 'estaciones',
]

// Shared across StationGate/StationsManager/Topbar so every station-facing
// view labels and icons each role the same way — a distinct icon per role
// (not just ChefHat everywhere) so a cashier and a kitchen station are
// visually distinguishable at a glance on the picker/chip/CRUD cards.
export const ROLE_LABELS = {
  admin: 'Administración',
  cajero: 'Cajero',
  kitchen: 'Cocina',
}

export const ROLE_ICONS = {
  admin: ShieldCheck,
  cajero: CreditCard,
  kitchen: ChefHat,
}

// The three stations every install starts with. `admin`'s PIN reuses the
// existing ADMIN_PIN for continuity with the PIN system this replaces.
// `cajero` is seeded with a conservative default disabledRoutes list —
// adjustable at any time from /admin/estaciones.
export const DEFAULT_STATIONS = [
  {
    id: 'admin',
    name: 'Administración',
    pin: ADMIN_PIN,
    role: 'admin',
    productTags: [],
    isCore: true,
    disabledRoutes: [],
  },
  {
    id: 'cajero',
    name: 'Cajero',
    pin: '1111',
    role: 'cajero',
    productTags: [],
    isCore: true,
    disabledRoutes: ['estaciones', 'finanzas', 'metricas', 'promociones', 'menu', 'stock', 'legacy'],
  },
  {
    id: 'cocina',
    name: 'Cocina',
    pin: '2222',
    role: 'kitchen',
    productTags: [],
    isCore: true,
    disabledRoutes: [],
  },
]

// One-time seed. Safe to call on every login — only writes if the
// collection is empty.
export const seedStationsIfEmpty = async () => {
  const snap = await getDocs(collection(db, 'stations'))
  if (!snap.empty) return
  const batch = writeBatch(db)
  DEFAULT_STATIONS.forEach((station) => {
    const { id, ...rest } = station
    batch.set(doc(db, 'stations', id), {
      ...rest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

// Resolves a ticket item's station tags fresh from the product doc
// (falling back to whatever was stamped on the item itself), then decides
// which stations should see it:
//   - a station with no productTags configured is a catch-all — it shows
//     every product, tagged or not (lets an owner run a single untagged
//     kitchen station and just have everything land there)
//   - a product with no stationTags shows on every kitchen-role station —
//     so an unconfigured menu still routes to the kitchen instead of
//     silently going nowhere
//   - otherwise, normal tag intersection: the item shows on a station only
//     if they share at least one tag
export const stationsForItem = (item, stations, productsById = {}) => {
  const product = productsById[item.productDocId] || productsById[item.id]
  const tags = Array.isArray(product?.stationTags) && product.stationTags.length
    ? product.stationTags
    : (Array.isArray(item.stationTags) ? item.stationTags : [])

  return stations.filter((station) => {
    const stationTags = Array.isArray(station.productTags) ? station.productTags : []
    if (!stationTags.length) return true
    if (!tags.length) return station.role === 'kitchen'
    return stationTags.some((tag) => tags.includes(tag))
  })
}

export const deriveGroupStatus = (items = []) => {
  if (!items.length) return 'pending'
  if (items.every((item) => item.itemStatus === 'listo')) return 'listo'
  if (items.some((item) => item.itemStatus === 'preparando' || item.itemStatus === 'listo')) return 'preparando'
  return 'pending'
}

// Groups order items by station, stamping each line with a stable _sid
// (station id) and _lineId (the cart line's id, so a re-send can match
// existing lines and preserve in-progress status via prevStationItems).
export const buildStationItems = (items, stations, productsById = {}, prevStationItems = {}) => {
  const grouped = {}

  items.forEach((item) => {
    const lineId = item.cartItemId || item.id
    const targetStations = stationsForItem(item, stations, productsById)
    targetStations.forEach((station) => {
      if (!grouped[station.id]) grouped[station.id] = []
      const prevItem = prevStationItems?.[station.id]?.items?.find((prev) => prev._lineId === lineId)
      grouped[station.id].push({
        ...item,
        _sid: station.id,
        _lineId: lineId,
        itemStatus: prevItem?.itemStatus || 'pending',
      })
    })
  })

  const stationItems = {}
  Object.entries(grouped).forEach(([stationId, stationItemList]) => {
    stationItems[stationId] = {
      items: stationItemList,
      status: deriveGroupStatus(stationItemList),
    }
  })
  return stationItems
}

export const isOrderFullyDone = (order) => {
  const stationItems = order?.stationItems || {}
  const keys = Object.keys(stationItems)
  if (!keys.length) return false
  return keys.every((key) => stationItems[key].status === 'listo')
}

// Single atomic write: routes an order to its stations and stamps the
// sentToKitchen/kitchenSentAt fields, optionally merging extraFields
// (used by a re-send with edited items/total, or the WhatsApp review flow).
export const routeOrderToStations = async (orderId, order, stations, { productsById = {}, prevStationItems = null, extraFields = {} } = {}) => {
  const items = extraFields.items || order.items || []
  const stationItems = buildStationItems(items, stations, productsById, prevStationItems || order.stationItems || {})

  const batch = writeBatch(db)
  batch.update(doc(db, 'orders', orderId), {
    ...extraFields,
    stationItems,
    sentToKitchen: true,
    kitchenSentAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
  return stationItems
}
