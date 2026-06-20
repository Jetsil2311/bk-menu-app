import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { TrendingUp, TrendingDown, Award, DollarSign, ShoppingBag, Calendar } from 'lucide-react'

const RANGE_OPTIONS = [
  { label: 'Esta semana', days: 7 },
  { label: 'Este mes', days: 30 },
  { label: '3 meses', days: 90 },
]

// Local YYYY-MM-DD string — avoids UTC timezone shift misattributing evening sales to the next day
const localDateStr = (d) => [
  d.getFullYear(),
  String(d.getMonth() + 1).padStart(2, '0'),
  String(d.getDate()).padStart(2, '0'),
].join('-')

// Legacy format parser: "1 x ProductName (option) - $XX"
const parseItemsFromContent = (content = '') => {
  return content
    .split('\n')
    .filter(l => /^\d+\s*x\s/.test(l.trim()))
    .map(l => {
      const match = l.trim().match(/^(\d+)\s*x\s+(.+?)\s*(?:\(.*?\))?\s*(?:\[.*?\])?\s*-/)
      if (!match) return null
      return { qty: Number(match[1] || 1), name: match[2].trim() }
    })
    .filter(Boolean)
}

// Modern orders store an items array; legacy orders used a content string
const getOrderItems = (order) => {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items
      .map(it => ({ qty: Number(it.qty || 1), name: it.name }))
      .filter(it => it.name)
  }
  return parseItemsFromContent(order.content)
}

export const Metrics = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [rangeIdx, setRangeIdx] = useState(0)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'orders'))
        const data = snapshot.docs.map(d => ({
          ...d.data(),
          id: d.id,
          createdAt: d.data().createdAt?.toDate() || new Date(),
        }))
        setOrders(data)
      } catch (err) {
        console.error('Error fetching orders:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  const { days } = RANGE_OPTIONS[rangeIdx]

  // Build day-by-day revenue for the selected range
  const dayLabels = [...Array(days)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    return d
  })

  const revenueByDay = dayLabels.map(day => {
    const dayStr = localDateStr(day)
    const dayOrders = orders.filter(o =>
      (o.status || '').toLowerCase() !== 'reembolsado' &&
      localDateStr(o.createdAt) === dayStr
    )
    const revenue = dayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    return {
      name: day.toLocaleDateString('es-MX', { weekday: days <= 7 ? 'short' : undefined, day: 'numeric', month: days > 7 ? 'short' : undefined }),
      revenue,
      count: dayOrders.length,
    }
  })

  // Top products — reads from modern items array or legacy content string
  const productCounts = {}
  orders.forEach(order => {
    if ((order.status || '').toLowerCase() === 'reembolsado') return
    getOrderItems(order).forEach(({ qty, name }) => {
      productCounts[name] = (productCounts[name] || 0) + qty
    })
  })
  const topProducts = Object.entries(productCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const maxCount = topProducts[0]?.count || 1

  // Period summary
  const periodStart = new Date()
  periodStart.setDate(periodStart.getDate() - days)
  const prevStart = new Date(periodStart)
  prevStart.setDate(prevStart.getDate() - days)

  const isNotRefunded = o => (o.status || '').toLowerCase() !== 'reembolsado'
  const periodOrders = orders.filter(o => isNotRefunded(o) && o.createdAt >= periodStart)
  const prevOrders = orders.filter(o => isNotRefunded(o) && o.createdAt >= prevStart && o.createdAt < periodStart)

  const periodRev = periodOrders.reduce((s, o) => s + Number(o.total || 0), 0)
  const prevRev = prevOrders.reduce((s, o) => s + Number(o.total || 0), 0)
  const revChange = prevRev > 0 ? ((periodRev - prevRev) / prevRev * 100).toFixed(1) : null

  const totalAllOrders = orders.length
  const totalAllRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0)
  const avgTicket = totalAllOrders > 0 ? (totalAllRevenue / totalAllOrders) : 0

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Range selector */}
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-light-200/40" />
        <div className="flex items-center gap-1 p-1 rounded-xl bg-main-900/30 border border-white/5">
          {RANGE_OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              onClick={() => setRangeIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${rangeIdx === i ? 'bg-main-500 text-white' : 'text-light-200/50 hover:text-light-100'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-main-900/30 border border-white/5 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-light-100">Ingresos ({RANGE_OPTIONS[rangeIdx].label})</h3>
              <p className="text-xs text-light-200/40">Ventas diarias en MXN</p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp size={20} />
            </div>
          </div>

          {loading ? (
            <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueByDay}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a34d3b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a34d3b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#fef8e1', opacity: 0.4, fontSize: 11 }}
                    dy={8}
                    interval={days > 14 ? Math.floor(days / 7) : 0}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#fef8e1', opacity: 0.4, fontSize: 11 }}
                    tickFormatter={v => v > 0 ? `$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}` : '0'}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#26100b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fef8e1',
                    }}
                    formatter={(value) => [`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Ingresos']}
                    itemStyle={{ color: '#a34d3b' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#a34d3b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-main-900/30 border border-white/5 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-light-100">Top 5 Productos</h3>
            <Award size={20} className="text-amber-400" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : topProducts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-light-200/30 italic">Datos insuficientes.</p>
              <p className="text-xs text-light-200/20 mt-1">Se necesitan pedidos con detalle de productos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-main-400 w-4">{index + 1}</span>
                      <span className="text-sm font-medium text-light-100 truncate max-w-[140px]">{product.name}</span>
                    </div>
                    <span className="text-xs text-light-200/50">{product.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-main-500"
                      style={{ width: `${(product.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-main-900/30 border border-white/5 rounded-3xl p-6 shadow-sm flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-main-500/10 flex items-center justify-center text-main-400 shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-light-200/40 uppercase tracking-wider">Ticket Promedio</p>
            <h4 className="text-2xl font-bold text-light-100 mt-1">
              {loading ? '—' : `$${avgTicket.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </h4>
            <p className="text-[10px] text-light-200/30 mt-0.5">Histórico total</p>
          </div>
        </div>

        <div className="bg-main-900/30 border border-white/5 rounded-3xl p-6 shadow-sm flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-light-200/40 uppercase tracking-wider">Pedidos ({RANGE_OPTIONS[rangeIdx].label})</p>
            <h4 className="text-2xl font-bold text-light-100 mt-1">
              {loading ? '—' : periodOrders.length.toLocaleString('es-MX')}
            </h4>
            <p className="text-[10px] text-light-200/30 mt-0.5">Total histórico: {totalAllOrders}</p>
          </div>
        </div>

        <div className="bg-main-900/30 border border-white/5 rounded-3xl p-6 shadow-sm flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
            {revChange !== null && Number(revChange) >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
          <div>
            <p className="text-xs font-medium text-light-200/40 uppercase tracking-wider">Ingresos ({RANGE_OPTIONS[rangeIdx].label})</p>
            <h4 className="text-2xl font-bold text-light-100 mt-1">
              {loading ? '—' : `$${periodRev.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
            </h4>
            {revChange !== null ? (
              <p className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${Number(revChange) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {Number(revChange) >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(Number(revChange))}% vs período anterior
              </p>
            ) : (
              <p className="text-[10px] text-light-200/20 mt-0.5">Sin datos de período anterior</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
