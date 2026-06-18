/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useAdminDashboard } from '../../hooks/useAdminDashboard'
import {
  TrendingUp,
  TrendingDown,
  PlusCircle,
  ListPlus,
  Settings,
  Plus,
  ArrowRight,
  Clock,
  Package,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../../firebase'
import { PastSessionRow } from './Register'

const todayKey = () => {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

export const Overview = () => {
  const { stats, recentOrders, loading } = useAdminDashboard()
  const navigate = useNavigate()

  const [histOpen, setHistOpen]       = useState(false)
  const [histLoaded, setHistLoaded]   = useState(false)
  const [histLoading, setHistLoading] = useState(false)
  const [pastSessions, setPastSessions] = useState([])

  const toggleHist = async () => {
    const next = !histOpen
    setHistOpen(next)
    if (next && !histLoaded) {
      setHistLoading(true)
      try {
        const q = query(collection(db, 'register_sessions'), orderBy('date', 'desc'), limit(31))
        const snap = await getDocs(q)
        const today = todayKey()
        setPastSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.date !== today).slice(0, 30))
        setHistLoaded(true)
      } catch { /* silently fail */ }
      finally { setHistLoading(false) }
    }
  }

  const calculateTrend = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const StatCard = ({ title, value, previousValue, prefix = '' }) => {
    const trend = calculateTrend(value, previousValue)
    const isPositive = trend >= 0
    const hasPrevData = previousValue > 0

    return (
      <div className="bg-main-900/50 border border-white/5 rounded-3xl p-6 shadow-sm">
        <p className="text-xs font-medium text-light-200/40 uppercase tracking-wider">{title}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <h3 className="text-3xl font-bold text-light-100">
            {prefix}{loading ? '—' : value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
          </h3>
          {!loading && hasPrevData && (
            <span className={`text-xs font-medium flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend).toFixed(0)}%
            </span>
          )}
        </div>
        {!loading && hasPrevData && (
          <p className="text-[10px] text-light-200/30 mt-1">vs ayer</p>
        )}
      </div>
    )
  }

  const quickActions = [
    {
      name: 'Abrir POS',
      icon: ShoppingCart,
      action: () => navigate('/admin/pos'),
    },
    {
      name: 'Agregar producto',
      icon: PlusCircle,
      action: () => navigate('/admin/menu', { state: { openAddProduct: true } }),
    },
    {
      name: 'Actualizar menú',
      icon: ListPlus,
      action: () => navigate('/admin/menu'),
    },
    {
      name: 'Agregar sección',
      icon: Plus,
      action: () => navigate('/admin/menu', { state: { openAddSection: true } }),
    },
    {
      name: 'Gestionar toppings',
      icon: Settings,
      action: () => navigate('/admin/menu', { state: { tab: 'toppings' } }),
    },
  ]

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'nuevo':            return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'preparando':
      case 'en preparación':   return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'listo':            return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'pagado':
      case 'entregado':        return 'bg-light-200/5 text-light-200/40 border-light-200/10'
      default:                 return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Pedidos Hoy"
          value={stats.ordersToday}
          previousValue={stats.prevOrdersToday}
        />
        <StatCard
          title="Ingresos del Día"
          value={stats.revenueToday}
          previousValue={stats.prevRevenueToday}
          prefix="$"
        />
        <StatCard
          title="Promedio Ticket"
          value={stats.avgTicket}
          previousValue={0}
          prefix="$"
        />
      </div>

      {/* Quick Actions Strip */}
      <div className="flex flex-wrap gap-3 items-center">
        <p className="text-sm font-medium text-light-200/60 mr-2">Acciones rápidas:</p>
        {quickActions.map((action) => (
          <button
            key={action.name}
            type="button"
            onClick={action.action}
            className="flex items-center gap-2 px-4 py-2 bg-main-900/40 hover:bg-main-500/20 border border-white/5 hover:border-main-500/30 rounded-full text-sm font-medium text-light-100 transition-all duration-200 cursor-pointer"
          >
            <action.icon size={16} className="text-main-400" />
            {action.name}
          </button>
        ))}
      </div>

      {/* Recent Orders Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-light-100 flex items-center gap-2">
            <Package size={20} className="text-main-400" />
            Pedidos Recientes
          </h2>
          <NavLink
            to="/admin/pedidos"
            className="text-sm font-medium text-main-400 hover:text-main-300 flex items-center gap-1 transition-colors"
          >
            Ver todos <ArrowRight size={14} />
          </NavLink>
        </div>

        <div className="bg-main-900/30 border border-white/5 rounded-3xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="divide-y divide-white/5">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-5 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-white/5 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 rounded bg-white/5 animate-pulse" />
                    <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="p-12 text-center text-light-200/40 italic">No hay pedidos registrados.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentOrders.slice(0, 5).map((order) => {
                const shortId = order.orderId
                  ? order.orderId.slice(-6)
                  : order.id.slice(-4).toUpperCase()
                const timeStr = order.createdAt instanceof Date
                  ? order.createdAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                  : order.createdAt?.toDate?.()?.toLocaleTimeString?.('es-MX', { hour: '2-digit', minute: '2-digit' }) ?? '—'

                // Parse item names from content string (format: "1. 1 x ProductName - $XX")
                const contentLines = (order.content || '').split('\n')
                const itemLines = contentLines.filter(l => /^\d+\./.test(l.trim()))
                const itemNames = itemLines.map(l => l.replace(/^\d+\.\s*\d+\s*x\s*/, '').split(' -')[0].trim()).filter(Boolean)
                const displayItems = itemNames.length > 0
                  ? (itemNames.length > 2 ? itemNames.slice(0, 2).join(', ') + ` +${itemNames.length - 2} más` : itemNames.join(', '))
                  : '—'

                return (
                  <div key={order.id} className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-main-800 flex items-center justify-center text-main-400 font-bold text-xs border border-white/5">
                        #{shortId}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-light-100">
                            ${Number(order.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                            {order.status || 'Nuevo'}
                          </span>
                        </div>
                        <p className="text-xs text-light-200/40 flex items-center gap-1 mt-0.5">
                          <Clock size={12} />
                          {timeStr}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <p className="hidden sm:block text-xs font-medium text-light-200/50 truncate max-w-[160px]">
                        {displayItems}
                      </p>
                      <NavLink
                        to="/admin/pedidos"
                        className="p-2 rounded-xl bg-white/5 text-light-200/40 hover:text-light-100 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <ArrowRight size={18} />
                      </NavLink>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Register History Dropdown */}
      <div className="bg-main-900/30 border border-white/5 rounded-3xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={toggleHist}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <Calendar size={16} className="text-light-200/30 shrink-0" />
            <span className="text-sm font-semibold text-light-200/60">Historial de Caja</span>
            {histLoaded && pastSessions.length > 0 && (
              <span className="text-[10px] text-light-200/25 tabular-nums">{pastSessions.length} sesiones</span>
            )}
          </div>
          {histOpen
            ? <ChevronUp size={15} className="text-light-200/25 shrink-0" />
            : <ChevronDown size={15} className="text-light-200/25 shrink-0" />
          }
        </button>

        {histOpen && (
          <div className="border-t border-white/5">
            {histLoading ? (
              <div className="py-10 text-center text-sm text-light-200/30 animate-pulse">Cargando historial…</div>
            ) : pastSessions.length === 0 ? (
              <div className="py-10 text-center text-sm text-light-200/25 italic">Sin sesiones anteriores</div>
            ) : (
              <div className="divide-y divide-white/5">
                {pastSessions.map(s => <PastSessionRow key={s.id} session={s} />)}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
