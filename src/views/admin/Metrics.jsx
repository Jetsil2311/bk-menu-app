import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { isPaidOrderStatus } from '../../utils/orderStatus'
import { computeOrderRevenue, orderDate } from '../../utils/financeCalculations'
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
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [rangeIdx, setRangeIdx] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersSnap, sessionsSnap] = await Promise.all([
          getDocs(collection(db, 'orders')),
          getDocs(collection(db, 'register_sessions')),
        ])
        setOrders(ordersSnap.docs.map(d => ({
          ...d.data(),
          id: d.id,
          createdAt: d.data().createdAt?.toDate() || new Date(),
          paidDate: orderDate(d.data()) || new Date(0),
          revenue: computeOrderRevenue(d.data()),
        })))
        setSessions(sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Error fetching metrics data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const { days } = RANGE_OPTIONS[rangeIdx]

  // Build day-by-day revenue for the selected range
  const dayLabels = [...Array(days)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    return d
  })

  // register_sessions docs are keyed by the same local 'YYYY-MM-DD' string as localDateStr().
  const sessionsByDate = {}
  sessions.forEach(s => { sessionsByDate[s.id] = s })

  // Revenue graph reads cashSales + cardSales straight from each day's register session —
  // the same fields/collection Overview's register history reads — instead of summing
  // order totals. This is a deliberate change: order totals include loyalty-redeemed
  // amounts (not real cash/card income) and were bucketed by order.createdAt, which can
  // land on a different calendar day than the order was actually paid, so the two views
  // used to disagree. A day with no register session (never opened) correctly shows $0.
  const revenueByDay = dayLabels.map(day => {
    const dayStr = localDateStr(day)
    const session = sessionsByDate[dayStr]
    const revenue = (session?.cashSales || 0) + (session?.cardSales || 0)
    return {
      name: day.toLocaleDateString('es-MX', { weekday: days <= 7 ? 'short' : undefined, day: 'numeric', month: days > 7 ? 'short' : undefined }),
      revenue,
    }
  })

  // Top products — reads from modern items array or legacy content string
  // Only paid orders are sales (same rule as Finanzas and Inicio) — cancelled,
  // refunded, still-in-kitchen and old WhatsApp text snapshots don't count.
  const productCounts = {}
  orders.forEach(order => {
    if (!isPaidOrderStatus(order.status)) return
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

  const paidOrders = orders.filter(o => isPaidOrderStatus(o.status))
  const periodOrders = paidOrders.filter(o => o.paidDate >= periodStart)
  const prevOrders = paidOrders.filter(o => o.paidDate >= prevStart && o.paidDate < periodStart)

  const periodRev = periodOrders.reduce((s, o) => s + o.revenue, 0)
  const prevRev = prevOrders.reduce((s, o) => s + o.revenue, 0)
  const revChange = prevRev > 0 ? ((periodRev - prevRev) / prevRev * 100).toFixed(1) : null

  const totalAllOrders = paidOrders.length
  const totalAllRevenue = paidOrders.reduce((s, o) => s + o.revenue, 0)
  const avgTicket = totalAllOrders > 0 ? (totalAllRevenue / totalAllOrders) : 0

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Range selector */}
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-light-200/65" />
        <div className="flex items-center gap-1 p-1 rounded-xl bg-main-900 border border-white/10">
          {RANGE_OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              onClick={() => setRangeIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${rangeIdx === i ? 'bg-main-500 text-snow' : 'text-light-200/70 hover:text-light-100'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-main-900 border border-white/10 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-light-100">Ingresos ({RANGE_OPTIONS[rangeIdx].label})</h3>
              <p className="text-xs text-light-200/65">Efectivo + tarjeta cobrados cada día (según la caja)</p>
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
                      <stop offset="5%" stopColor="var(--color-chart-brand)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-chart-brand)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }}
                    dy={8}
                    interval={days > 14 ? Math.floor(days / 7) : 0}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }}
                    tickFormatter={v => v > 0 ? `$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}` : '0'}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-chart-tooltip-bg)',
                      border: '1px solid var(--color-chart-grid)',
                      borderRadius: '12px',
                      color: 'var(--color-chart-tooltip-ink)',
                    }}
                    formatter={(value) => [`$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Ingresos']}
                    itemStyle={{ color: 'var(--color-chart-brand)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-chart-brand)"
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
        <div className="bg-main-900 border border-white/10 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-light-100">Lo más vendido</h3>
            <Award size={20} className="text-amber-400" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : topProducts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-light-200/55 italic">Datos insuficientes.</p>
              <p className="text-xs text-light-200/45 mt-1">Aparecerá cuando haya pedidos pagados.</p>
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
                    <span className="text-xs text-light-200/70">{product.count}</span>
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
        <div className="bg-main-900 border border-white/10 rounded-3xl p-6 shadow-sm flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-main-500/10 flex items-center justify-center text-main-400 shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-light-200/65 uppercase tracking-wider">Ticket Promedio</p>
            <h4 className="text-2xl font-bold text-light-100 mt-1">
              {loading ? '—' : `$${avgTicket.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </h4>
            <p className="text-[10px] text-light-200/55 mt-0.5">Histórico total</p>
          </div>
        </div>

        <div className="bg-main-900 border border-white/10 rounded-3xl p-6 shadow-sm flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-light-200/65 uppercase tracking-wider">Pedidos ({RANGE_OPTIONS[rangeIdx].label})</p>
            <h4 className="text-2xl font-bold text-light-100 mt-1">
              {loading ? '—' : periodOrders.length.toLocaleString('es-MX')}
            </h4>
            <p className="text-[10px] text-light-200/55 mt-0.5">Total histórico: {totalAllOrders}</p>
          </div>
        </div>

        <div className="bg-main-900 border border-white/10 rounded-3xl p-6 shadow-sm flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
            {revChange !== null && Number(revChange) >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
          <div>
            <p className="text-xs font-medium text-light-200/65 uppercase tracking-wider">Ingresos ({RANGE_OPTIONS[rangeIdx].label})</p>
            <h4 className="text-2xl font-bold text-light-100 mt-1">
              {loading ? '—' : `$${periodRev.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
            </h4>
            {revChange !== null ? (
              <p className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${Number(revChange) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {Number(revChange) >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(Number(revChange))}% vs período anterior
              </p>
            ) : (
              <p className="text-[10px] text-light-200/45 mt-0.5">Sin datos de período anterior</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
