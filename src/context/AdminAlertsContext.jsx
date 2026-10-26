/* eslint-disable react/prop-types */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useStationContext } from './StationContext'
import { WEB_ORDERS_COLLECTION, WEB_ORDER_STATUS, webOrderPreview } from '../utils/webOrders'
import { lowStockList } from '../utils/stockAlerts'
import { isStaleWhatsAppSnapshot } from '../utils/orderCleanup'
import { formatMoney } from '../utils/cart'
import {
  notificationPermission, playAlertSound, requestNotificationPermission,
  showSystemNotification, unlockAlertSound,
} from '../utils/adminAlerts'

// Everything the panel needs to grab staff attention, in one place:
//   • pending web orders (web_orders, status 'pending') → popup + sound +
//     system notification, one-click import into Cobrar
//   • raw materials at/below their warning level → toast + nav warning
// Mounted once in AdminLayout; Topbar, Sidebar, BottomTabBar and the alert
// popups all read from here so they always agree.
const AdminAlertsContext = createContext(null)

const REMINDER_MS = 90_000 // re-chime while an order still waits unanswered

const toDate = (ts) => ts?.toDate?.() ?? null

export const AdminAlertsProvider = ({ children }) => {
  const navigate = useNavigate()
  const { selectedStation } = useStationContext()
  const disabledRoutes = selectedStation?.disabledRoutes || []
  const canTakeOrders = !disabledRoutes.includes('pos')

  // ── Web orders ────────────────────────────────────────────────────────────
  const [pendingOrders, setPendingOrders] = useState([])
  // Orders the popup still has to show (new ones, or pending on load that
  // nobody has looked at yet in this tab).
  const [unseenIds, setUnseenIds] = useState([])
  const knownOrderIds = useRef(null)

  // ── Stock ─────────────────────────────────────────────────────────────────
  const [lowStock, setLowStock] = useState([])
  const [stockToast, setStockToast] = useState(null) // { items, isNew }
  const knownLowIds = useRef(null)

  const [permission, setPermission] = useState(notificationPermission)

  // Audio can only start after a tap; unlock it on the first one.
  useEffect(() => {
    const unlock = () => unlockAlertSound()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const importOrder = useCallback((orderId) => {
    setUnseenIds((ids) => ids.filter((id) => id !== orderId))
    navigate('/admin/pos', { state: { importWebOrder: orderId } })
  }, [navigate])
  // The listener below outlives navigations; read the latest importOrder
  // through a ref so moving between pages doesn't re-subscribe.
  const importRef = useRef(importOrder)
  importRef.current = importOrder

  // Single-field where → no composite index needed; sorted client-side.
  useEffect(() => {
    if (!canTakeOrders) {
      setPendingOrders([])
      return undefined
    }
    const q = query(collection(db, WEB_ORDERS_COLLECTION), where('status', '==', WEB_ORDER_STATUS.pending))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const orders = snap.docs
          .map((d) => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }))
          .sort((a, b) => (a.createdAt?.getTime() ?? Infinity) - (b.createdAt?.getTime() ?? Infinity))
        setPendingOrders(orders)

        const ids = orders.map((o) => o.id)
        if (knownOrderIds.current === null) {
          // First load: show what's already waiting, quietly.
          knownOrderIds.current = new Set(ids)
          setUnseenIds(ids)
          return
        }
        const fresh = orders.filter((o) => !knownOrderIds.current.has(o.id))
        knownOrderIds.current = new Set(ids)
        setUnseenIds((prev) => [...prev.filter((id) => ids.includes(id)), ...fresh.map((o) => o.id)])
        if (fresh.length > 0) {
          playAlertSound('order')
          const latest = fresh[fresh.length - 1]
          showSystemNotification({
            title: fresh.length === 1 ? 'Nuevo pedido del menú' : `${fresh.length} pedidos nuevos del menú`,
            body: `${webOrderPreview(latest)} · ${formatMoney(Number(latest.total || 0))}`,
            tag: 'bk-web-order',
            requireInteraction: true,
            onClick: () => importRef.current(latest.id),
          })
        }
      },
      (error) => console.error('Error listening to web orders:', error)
    )
    return () => unsub()
  }, [canTakeOrders])

  // Keep chiming while the popup is still waiting for an answer.
  useEffect(() => {
    if (unseenIds.length === 0) return undefined
    const timer = setInterval(() => playAlertSound('order'), REMINDER_MS)
    return () => clearInterval(timer)
  }, [unseenIds.length])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'rawMaterials'),
      (snap) => {
        const low = lowStockList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLowStock(low)
        const ids = low.map((m) => m.id)
        if (knownLowIds.current === null) {
          knownLowIds.current = new Set(ids)
          let shown = false
          try { shown = sessionStorage.getItem('bk_stock_alert_seen') === ids.join('|') } catch { /* private mode */ }
          if (low.length > 0 && !shown) setStockToast({ items: low, isNew: false })
          return
        }
        const fresh = low.filter((m) => !knownLowIds.current.has(m.id))
        knownLowIds.current = new Set(ids)
        if (fresh.length > 0) {
          setStockToast({ items: fresh, isNew: true })
          playAlertSound('stock')
          showSystemNotification({
            title: fresh.length === 1 ? `Se está acabando: ${fresh[0].name}` : `${fresh.length} insumos se están acabando`,
            body: fresh.map((m) => m.name).join(', '),
            tag: 'bk-low-stock',
          })
        }
      },
      (error) => console.error('Error listening to stock levels:', error)
    )
    return () => unsub()
  }, [])

  // Once per admin session: remove old WhatsApp text snapshots left in
  // `orders` from before web_orders existed (nobody acted on them, or they
  // were discarded). Paid or worked-on orders are never touched — see
  // utils/orderCleanup.js.
  useEffect(() => {
    if (!canTakeOrders) return
    const orders = collection(db, 'orders')
    Promise.all([
      getDocs(query(orders, where('reviewed', '==', false))),
      getDocs(query(orders, where('discarded', '==', true))),
    ]).then(async (snaps) => {
      const now = new Date()
      const stale = new Map()
      for (const snap of snaps) {
        for (const d of snap.docs) if (isStaleWhatsAppSnapshot(d.data(), now)) stale.set(d.id, d.ref)
      }
      const refs = [...stale.values()]
      for (let i = 0; i < refs.length; i += 400) {
        const batch = writeBatch(db)
        refs.slice(i, i + 400).forEach((ref) => batch.delete(ref))
        await batch.commit()
      }
    }).catch((error) => console.error('WhatsApp snapshot cleanup failed:', error))
  }, [canTakeOrders])

  const dismissOrder = useCallback(async (orderId) => {
    setUnseenIds((ids) => ids.filter((id) => id !== orderId))
    await updateDoc(doc(db, WEB_ORDERS_COLLECTION, orderId), {
      status: WEB_ORDER_STATUS.dismissed,
      dismissedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }, [])

  // "Ver después": closes the popup; the order stays in the bell and the bar.
  const snoozeOrders = useCallback(() => setUnseenIds([]), [])
  const reopenOrders = useCallback(() => setUnseenIds(pendingOrders.map((o) => o.id)), [pendingOrders])

  const closeStockToast = useCallback(() => {
    try { sessionStorage.setItem('bk_stock_alert_seen', lowStock.map((m) => m.id).join('|')) } catch { /* private mode */ }
    setStockToast(null)
  }, [lowStock])

  const askPermission = useCallback(async () => {
    unlockAlertSound()
    setPermission(await requestNotificationPermission())
  }, [])

  // Per nav item: a number (count pill) or 'warn' (warning icon).
  const navBadges = useMemo(() => ({
    pos: pendingOrders.length || null,
    stock: lowStock.length > 0 ? 'warn' : null,
    finanzas: lowStock.length > 0 ? 'warn' : null,
  }), [pendingOrders.length, lowStock.length])

  const value = useMemo(() => ({
    navBadges,
    pendingOrders,
    popupOrders: pendingOrders.filter((o) => unseenIds.includes(o.id)),
    importOrder,
    dismissOrder,
    snoozeOrders,
    reopenOrders,
    lowStock,
    stockToast,
    closeStockToast,
    permission,
    askPermission,
    canTakeOrders,
  }), [navBadges, pendingOrders, unseenIds, importOrder, dismissOrder, snoozeOrders, reopenOrders,
    lowStock, stockToast, closeStockToast, permission, askPermission, canTakeOrders])

  return <AdminAlertsContext.Provider value={value}>{children}</AdminAlertsContext.Provider>
}

export const useAdminAlerts = () => {
  const ctx = useContext(AdminAlertsContext)
  if (!ctx) throw new Error('useAdminAlerts must be used within an AdminAlertsProvider')
  return ctx
}
