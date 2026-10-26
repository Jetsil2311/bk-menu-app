import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { summarizeDailySales } from '../utils/dailySales'

export const useAdminDashboard = () => {
  const [stats, setStats] = useState({
    ordersToday: 0,
    revenueToday: 0,
    avgTicket: 0,
    prevOrdersToday: 0,
    prevRevenueToday: 0,
    prevAvgTicket: 0,
    pendingToday: 0,
  })
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Real-time listener for recent orders display only — no stats calculation here
  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (cancelled) return
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(10))
      unsub = onSnapshot(q, (snapshot) => {
        if (!alive) return
        // Legacy WhatsApp text snapshots (no status) were never real tickets.
        setRecentOrders(snapshot.docs.filter(doc => doc.data().status || doc.data().source !== 'whatsapp').map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        })))
      }, () => {
        if (!alive) return
        setError('Error al conectar con la base de datos')
      })
    }, 0)
    return () => {
      cancelled = true
      alive = false
      clearTimeout(timer)
      if (unsub) try { unsub() } catch {}
    }
  }, [])

  // Live "today" stats — same basis as Caja (paid orders, by payment time;
  // see utils/dailySales.js). A week of orders covers tabs opened earlier
  // and paid today, plus yesterday for the comparison.
  const [weekOrders, setWeekOrders] = useState(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // Moves "ayer a esta hora" along and rolls over at midnight.
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let alive = true
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - 7)
    const q = query(collection(db, 'orders'), where('createdAt', '>=', Timestamp.fromDate(since)))
    const unsub = onSnapshot(q, (snap) => {
      if (!alive) return
      // 'estimate' so an order charged a moment ago already has its paidAt.
      setWeekOrders(snap.docs.map((d) => d.data({ serverTimestamps: 'estimate' })))
      setLoading(false)
    }, () => {
      if (!alive) return
      setError('Error al cargar estadísticas')
      setLoading(false)
    })
    return () => {
      alive = false
      try { unsub() } catch { /* already ended */ }
    }
  }, [])

  useEffect(() => {
    if (weekOrders) setStats(summarizeDailySales(weekOrders, now))
  }, [weekOrders, now])

  return { stats, recentOrders, loading, error }
}
