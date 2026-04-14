/* eslint-disable react/prop-types */
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
  Package
} from 'lucide-react'
import { NavLink } from 'react-router'

export const Overview = () => {
  const { stats, recentOrders, loading } = useAdminDashboard()

  const calculateTrend = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const StatCard = ({ title, value, previousValue, prefix = '' }) => {
    const trend = calculateTrend(value, previousValue)
    const isPositive = trend >= 0

    return (
      <div className="bg-main-900/50 border border-white/5 rounded-3xl p-6 shadow-sm">
        <p className="text-xs font-medium text-light-200/40 uppercase tracking-wider">{title}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <h3 className="text-3xl font-bold text-light-100">
            {prefix}{loading ? '...' : value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
          </h3>
          {!loading && (
            <span className={`text-xs font-medium flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    )
  }

  const quickActions = [
    { name: 'Agregar producto', icon: PlusCircle, path: '/admin/legacy' },
    { name: 'Actualizar menú', icon: ListPlus, path: '/admin/legacy' },
    { name: 'Agregar sección', icon: Plus, path: '/admin/legacy' },
    { name: 'Gestionar toppings', icon: Settings, path: '/admin/legacy' },
  ]

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'nuevo': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'en preparación': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'listo': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'entregado': return 'bg-light-200/5 text-light-200/40 border-light-200/10'
      default: return 'bg-light-200/10 text-light-200/60 border-light-200/20'
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
          previousValue={stats.avgTicket} // No prev for this simplified
          prefix="$"
        />
      </div>

      {/* Quick Actions Strip */}
      <div className="flex flex-wrap gap-3 items-center">
        <p className="text-sm font-medium text-light-200/60 mr-2">Acciones rápidas:</p>
        {quickActions.map((action) => (
          <NavLink
            key={action.name}
            to={action.path}
            className="flex items-center gap-2 px-4 py-2 bg-main-900/40 hover:bg-main-500/20 border border-white/5 hover:border-main-500/30 rounded-full text-sm font-medium text-light-100 transition-all duration-200"
          >
            <action.icon size={16} className="text-main-400" />
            {action.name}
          </NavLink>
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
            <div className="p-8 text-center text-light-200/40 italic">Cargando pedidos...</div>
          ) : recentOrders.length === 0 ? (
            <div className="p-12 text-center text-light-200/40 italic">No hay pedidos registrados.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-main-800 flex items-center justify-center text-main-400 font-bold border border-white/5">
                      #{order.id.slice(-4).toUpperCase()}
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
                        {order.createdAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        <span className="mx-1">•</span>
                        {order.items?.length || 0} items
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block text-right">
                      <p className="text-xs font-medium text-light-100 truncate max-w-[150px]">
                        {order.items?.map(i => i.name).join(', ')}
                      </p>
                    </div>
                    <NavLink 
                      to="/admin/pedidos" 
                      className="p-2 rounded-xl bg-white/5 text-light-200/40 hover:text-light-100 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <ArrowRight size={18} />
                    </NavLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
