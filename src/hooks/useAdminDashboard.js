import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export const useAdminDashboard = () => {
  const [stats, setStats] = useState({
    ordersToday: 0,
    revenueToday: 0,
    avgTicket: 0,
    prevOrdersToday: 0,
    prevRevenueToday: 0,
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
        setRecentOrders(snapshot.docs.map(doc => ({
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

  // One-time stats fetch on mount — separate from the real-time listener
  useEffect(() => {
    let alive = true
    setLoading(true)

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfYesterday = startOfToday - 86400000

    getDocs(collection(db, 'orders')).then(allSnap => {
      if (!alive) return
      let todayCount = 0, todayRev = 0, yesterdayCount = 0, yesterdayRev = 0, totalRev = 0

      allSnap.docs.forEach(doc => {
        const data = doc.data()
        const time = (data.createdAt?.toDate() || new Date()).getTime()
        const total = Number(data.total || 0)
        totalRev += total
        if (time >= startOfToday) { todayCount++; todayRev += total }
        else if (time >= startOfYesterday) { yesterdayCount++; yesterdayRev += total }
      })

      setStats({
        ordersToday: todayCount,
        revenueToday: todayRev,
        avgTicket: allSnap.size > 0 ? totalRev / allSnap.size : 0,
        prevOrdersToday: yesterdayCount,
        prevRevenueToday: yesterdayRev,
      })
      setLoading(false)
    }).catch(() => {
      if (!alive) return
      setError('Error al cargar estadísticas')
      setLoading(false)
    })

    return () => { alive = false }
  }, [])

  return { stats, recentOrders, loading, error }
}
