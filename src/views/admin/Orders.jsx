import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { Clock, CheckCircle2, Package, RefreshCcw, User } from 'lucide-react'

export const Orders = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', startOfToday),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }))
      setOrders(ordersData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const updateStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus })
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'nuevo': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'en preparación': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'listo': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'entregado': return 'bg-light-200/5 text-light-200/40 border-light-200/10'
      default: return 'bg-light-200/10 text-light-200/60 border-light-200/20'
    }
  }

  const nextStatus = (currentStatus) => {
    const statuses = ['Nuevo', 'En preparación', 'Listo', 'Entregado']
    const currentIndex = statuses.findIndex(s => s.toLowerCase() === currentStatus?.toLowerCase())
    if (currentIndex === -1 || currentIndex === statuses.length - 1) return null
    return statuses[currentIndex + 1]
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-light-100">Pedidos del Día</h2>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-main-900/40 border border-white/5 rounded-xl text-xs font-medium text-light-200/60">
          <Clock size={14} />
          Hoy: {orders.length} pedidos
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="p-20 text-center">
            <RefreshCcw size={32} className="mx-auto text-main-500 animate-spin mb-4" />
            <p className="text-light-200/40">Cargando pedidos de hoy...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-main-900/20 border border-white/5 rounded-3xl p-20 text-center">
            <Package size={48} className="mx-auto text-light-200/10 mb-4" />
            <p className="text-light-200/40 italic">Aún no hay pedidos para el día de hoy.</p>
          </div>
        ) : (
          orders.map((order) => {
            const next = nextStatus(order.status || 'Nuevo')
            return (
              <div key={order.id} className="bg-main-900/30 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-white/10 transition-colors">
                <div className="flex gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-2xl bg-main-800 flex items-center justify-center text-main-400 font-bold border border-white/5">
                    #{order.id.slice(-4).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                        {order.status || 'Nuevo'}
                      </span>
                      <span className="text-xs text-light-200/40">
                        {order.createdAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-light-100 leading-tight">
                      {order.items?.map(item => (
                        <span key={item.id} className="inline-block mr-2">
                          <span className="text-main-400 font-bold">{item.quantity || 1}x</span> {item.name}
                        </span>
                      ))}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-light-200/60 mt-1">
                      <User size={12} />
                      <span>{order.customerName || 'Cliente'}</span>
                      {order.total && (
                        <>
                          <span className="mx-1">•</span>
                          <span className="font-bold text-light-200">${Number(order.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {next && (
                    <button
                      onClick={() => updateStatus(order.id, next)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-main-500 hover:bg-main-400 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-main-500/10"
                    >
                      <CheckCircle2 size={18} />
                      Marcar como {next}
                    </button>
                  )}
                  {order.status?.toLowerCase() === 'entregado' && (
                    <div className="px-4 py-2 text-xs font-bold text-light-200/20 flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      Completado
                    </div>
                  )}
                  <button className="h-11 w-11 flex items-center justify-center rounded-2xl bg-white/5 text-light-200/40 hover:text-light-100 hover:bg-white/10 transition-colors">
                    <Clock size={18} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
