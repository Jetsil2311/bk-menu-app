/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useAdminDashboard } from '../../hooks/useAdminDashboard'
import { useAdminAlerts } from '../../context/AdminAlertsContext'
import {
  TrendingUp,
  TrendingDown,
  PlusCircle,
  Landmark,
  ToggleRight,
  Megaphone,
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
  const { pendingOrders } = useAdminAlerts() // menu orders waiting in web_orders
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

  const StatCard = ({ title, value, previousValue, prefix = '', note }) => {
    const trend = calculateTrend(value, previousValue)
    const isPositive = trend >= 0
    const hasPrevData = previousValue > 0

    return (
      <div className="bg-main-900 border border-white/10 rounded-2xl p-4 sm:p-6">
        <p className="text-sm font-bold text-light-200/75">{title}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <h3 className="font-display text-[1.7rem] sm:text-4xl font-semibold text-light-100 tabular-nums">
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
          <p className="hidden sm:block text-xs text-light-200/65 mt-1">comparado con ayer a esta hora</p>
        )}
        {!loading && note && <p className="text-xs font-semibold text-amber-400 mt-1">{note}</p>}
      </div>
    )
  }

  // Everyday tasks first — each tile says what it does in plain words.
  const quickActions = [
    { name: 'Cobrar un pedido', desc: 'Abrir la pantalla de cobro', icon: ShoppingCart, action: () => navigate('/admin/pos') },
    { name: 'Caja del día', desc: 'Abrir, cerrar o registrar efectivo', icon: Landmark, action: () => navigate('/admin/caja') },
    { name: 'Marcar agotados', desc: 'Prender o apagar productos', icon: ToggleRight, action: () => navigate('/admin/menu') },
    { name: 'Nuevo producto', desc: 'Agregarlo al menú', icon: PlusCircle, action: () => navigate('/admin/menu', { state: { openAddProduct: true } }) },
    { name: 'Promoción', desc: 'Aviso para los clientes', icon: Megaphone, action: () => navigate('/admin/promociones') },
  ]

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'nuevo':            return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'preparando':
      case 'en preparación':   return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'listo':            return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'pagado':
      case 'entregado':        return 'bg-light-200/5 text-light-200/65 border-light-200/10'
      default:                 return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        {/* Paid orders only, like Caja — unpaid ones are listed apart. */}
        <StatCard
          title="Pedidos hoy"
          value={stats.ordersToday}
          previousValue={stats.prevOrdersToday}
          note={stats.pendingToday + pendingOrders.length > 0 ? `+${stats.pendingToday + pendingOrders.length} por cobrar` : null}
        />
        <StatCard
          title="Ventas de hoy"
          value={stats.revenueToday}
          previousValue={stats.prevRevenueToday}
          prefix="$"
        />
        <StatCard
          title="Ticket promedio"
          value={stats.avgTicket}
          previousValue={stats.prevAvgTicket}
          prefix="$"
        />
      </div>

      {/* Quick actions */}
      <section aria-label="Accesos rápidos">
        <h2 className="mb-3 text-sm font-bold text-light-200/75">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.name}
              type="button"
              onClick={action.action}
              className="group flex flex-col sm:flex-row items-start gap-2.5 sm:gap-3 rounded-2xl border border-white/10 bg-main-900 p-4 text-left transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-18px_var(--color-ink)] cursor-pointer"
            >
              <span className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary dark:text-main-300 flex items-center justify-center group-hover:bg-primary group-hover:text-snow transition-colors">
                <action.icon size={19} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-light-100 leading-tight">{action.name}</span>
                <span className="block text-xs text-light-200/70 mt-0.5 leading-snug">{action.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Recent Orders Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-light-100 flex items-center gap-2">
            <Package size={20} className="text-primary dark:text-main-300" />
            Pedidos recientes
          </h2>
          <NavLink
            to="/admin/pedidos"
            className="text-sm font-medium text-main-400 hover:text-main-300 flex items-center gap-1 transition-colors"
          >
            Ver todos <ArrowRight size={14} />
          </NavLink>
        </div>

        <div className="bg-main-900 border border-white/10 rounded-3xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="divide-y divide-white/10">
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
            <div className="p-12 text-center text-light-200/65 italic">No hay pedidos registrados.</div>
          ) : (
            <div className="divide-y divide-white/10">
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
                      <div className="h-10 w-10 rounded-2xl bg-main-800 flex items-center justify-center text-main-400 font-bold text-xs border border-white/10">
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
                        <p className="text-xs text-light-200/65 flex items-center gap-1 mt-0.5">
                          <Clock size={12} />
                          {timeStr}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <p className="hidden sm:block text-xs font-medium text-light-200/70 truncate max-w-[160px]">
                        {displayItems}
                      </p>
                      <NavLink
                        to="/admin/pedidos"
                        className="p-2 rounded-xl bg-white/5 text-light-200/65 hover:text-light-100 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
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
      <div className="bg-main-900 border border-white/10 rounded-3xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={toggleHist}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <Calendar size={16} className="text-light-200/55 shrink-0" />
            <span className="text-sm font-semibold text-light-200/60">Historial de Caja</span>
            {histLoaded && pastSessions.length > 0 && (
              <span className="text-[10px] text-light-200/50 tabular-nums">{pastSessions.length} sesiones</span>
            )}
          </div>
          {histOpen
            ? <ChevronUp size={15} className="text-light-200/50 shrink-0" />
            : <ChevronDown size={15} className="text-light-200/50 shrink-0" />
          }
        </button>

        {histOpen && (
          <div className="border-t border-white/10">
            {histLoading ? (
              <div className="py-10 text-center text-sm text-light-200/55 animate-pulse">Cargando historial…</div>
            ) : pastSessions.length === 0 ? (
              <div className="py-10 text-center text-sm text-light-200/50 italic">Sin sesiones anteriores</div>
            ) : (
              <div className="divide-y divide-white/10">
                {pastSessions.map(s => <PastSessionRow key={s.id} session={s} />)}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
