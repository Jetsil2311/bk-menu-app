import { useAdminDashboard } from '../../hooks/useAdminDashboard'
import { useAdminAlerts } from '../../context/AdminAlertsContext'
import { PlusCircle, ToggleRight, Megaphone, ArrowRight } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router'
import { StatStrip, StatusPill } from '../../components/admin/ui'
import { formatMoney } from '../../utils/cart'

const calculateTrend = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

// "+12% vs ayer" hint for a stat, or nothing when there's no data from yesterday.
const trendHint = (value, previous) => {
  if (!(previous > 0)) return {}
  const trend = calculateTrend(value, previous)
  return { hint: `${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend).toFixed(0)}% vs ayer a esta hora`, tone: trend >= 0 ? 'up' : 'down' }
}

// Item names from the order (line items first, legacy text content as fallback).
const itemSummary = (order) => {
  let names = (order.items || []).map((it) => it.name).filter(Boolean)
  if (names.length === 0) {
    const lines = (order.content || '').split('\n').filter((l) => /^\d+\./.test(l.trim()))
    names = lines.map((l) => l.replace(/^\d+\.\s*\d+\s*x\s*/, '').split(' -')[0].trim()).filter(Boolean)
  }
  if (names.length === 0) return ''
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
}

const timeOf = (date) => (date instanceof Date
  ? date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  : '')

export const Overview = () => {
  const { stats, recentOrders, loading } = useAdminDashboard()
  const { pendingOrders } = useAdminAlerts() // menu orders waiting in web_orders
  const navigate = useNavigate()

  const toCharge = stats.pendingToday + pendingOrders.length
  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  // Owner shortcuts that aren't already in the main nav (Cobrar, Pedidos, Caja are).
  const quickActions = [
    { name: 'Marcar agotados', icon: ToggleRight, action: () => navigate('/admin/menu') },
    { name: 'Nuevo producto', icon: PlusCircle, action: () => navigate('/admin/menu', { state: { openAddProduct: true } }) },
    { name: 'Promoción', icon: Megaphone, action: () => navigate('/admin/promociones') },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Today at a glance — sales lead, same basis as Caja (paid orders only) */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-light-200/60 first-letter:uppercase">{today}</p>
        <StatStrip
          lead
          loading={loading}
          items={[
            { label: 'Ventas de hoy', value: formatMoney(stats.revenueToday), ...trendHint(stats.revenueToday, stats.prevRevenueToday) },
            { label: 'Pedidos pagados', value: stats.ordersToday.toLocaleString('es-MX'), ...trendHint(stats.ordersToday, stats.prevOrdersToday) },
            { label: 'Ticket promedio', value: formatMoney(stats.avgTicket) },
          ]}
        />
        {!loading && toCharge > 0 && (
          <NavLink
            to="/admin/pedidos"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 text-sm font-bold text-amber-400 hover:bg-amber-500/15 transition-colors"
          >
            {toCharge} pedido{toCharge !== 1 ? 's' : ''} por cobrar <ArrowRight size={14} />
          </NavLink>
        )}
      </div>

      {/* Shortcuts */}
      <nav aria-label="Accesos rápidos" className="flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={action.name}
            type="button"
            onClick={action.action}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-main-900 px-4 text-sm font-bold text-light-100 transition-colors hover:border-primary/40 active:scale-[0.98] cursor-pointer"
          >
            <action.icon size={17} className="text-primary dark:text-main-300" aria-hidden="true" />
            {action.name}
          </button>
        ))}
      </nav>

      {/* Recent orders */}
      <section aria-labelledby="recent-orders" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="recent-orders" className="font-display text-xl font-semibold text-light-100">Pedidos recientes</h2>
          <NavLink
            to="/admin/pedidos"
            className="inline-flex min-h-[40px] items-center gap-1 text-sm font-bold text-primary dark:text-main-300 hover:underline"
          >
            Ver todos <ArrowRight size={14} />
          </NavLink>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-main-900">
          {loading ? (
            <div className="divide-y divide-white/10">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="h-3 w-12 rounded bg-white/5 animate-pulse" />
                  <div className="h-3 flex-1 rounded bg-white/5 animate-pulse" />
                  <div className="h-3 w-14 rounded bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-light-200/65">Todavía no hay pedidos.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {recentOrders.slice(0, 5).map((order) => (
                <li key={order.id}>
                  <NavLink
                    to="/admin/pedidos"
                    className="flex min-h-[56px] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                  >
                    <span className="w-[4.5rem] shrink-0 whitespace-nowrap text-sm tabular-nums text-light-200/60">{timeOf(order.createdAt)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-light-100">
                      {itemSummary(order) || order.customerName || 'Pedido'}
                    </span>
                    <StatusPill status={order.status} />
                    <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-light-100">
                      {formatMoney(Number(order.total || 0))}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
