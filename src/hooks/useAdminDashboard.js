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

  useEffect(() => {
    setLoading(true)
    
    // Listen for recent orders
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(10))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }))
      setRecentOrders(orders)
      
      // Calculate stats
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const startOfYesterday = startOfToday - 86400000
      
      let todayCount = 0
      let todayRev = 0
      let yesterdayCount = 0
      let yesterdayRev = 0
      let totalRev = 0
      
      // For real stats we should probably query the whole collection or have a stats doc
      // but following existing logic of fetching and filtering
      getDocs(collection(db, 'orders')).then(allSnap => {
        const allOrders = allSnap.docs.map(doc => ({
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }))
        
        allOrders.forEach(order => {
          const time = order.createdAt.getTime()
          const total = Number(order.total || 0)
          totalRev += total
          
          if (time >= startOfToday) {
            todayCount++
            todayRev += total
          } else if (time >= startOfYesterday && time < startOfToday) {
            yesterdayCount++
            yesterdayRev += total
          }
        })
        
        setStats({
          ordersToday: todayCount,
          revenueToday: todayRev,
          avgTicket: allOrders.length > 0 ? totalRev / allOrders.length : 0,
          prevOrdersToday: yesterdayCount,
          prevRevenueToday: yesterdayRev,
        })
        setLoading(false)
      }).catch(err => {
        setError('Error al cargar estadísticas')
        setLoading(false)
      })
    }, (err) => {
      setError('Error al conectar con la base de datos')
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { stats, recentOrders, loading, error }
}
