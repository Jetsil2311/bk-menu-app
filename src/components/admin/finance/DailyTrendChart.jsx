import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { formatMoney } from '../../../utils/cart'
import { orderDate } from '../../../utils/financeCalculations'
import { LineChart as LineChartIcon, X, Clock } from 'lucide-react'

const dayKey = (d) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
const dayLabel = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

const compactPeso = (v) => {
  const n = Number(v || 0)
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { fullLabel, revenue, profit } = payload[0].payload
  return (
    <div className="rounded-xl border border-white/10 bg-main-950 px-3 py-2.5 shadow-xl text-xs space-y-1.5 min-w-[9rem]">
      <p className="font-semibold text-light-100 capitalize">{fullLabel}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-light-200/70 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Ingresos</span>
        <span className="font-bold text-light-100 tabular-nums">{formatMoney(revenue)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-light-200/70 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" />Ganancia</span>
        <span className="font-bold text-light-100 tabular-nums">{formatMoney(profit)}</span>
      </div>
    </div>
  )
}

const DayOrdersModal = ({ day, orders, onClose }) => {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-main-900 border border-white/10 rounded-3xl w-full max-w-sm max-h-[80vh] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-light-100 capitalize">{day.fullLabel}</h3>
            <p className="text-xs text-light-200/65 mt-0.5">{orders.length} pedido{orders.length !== 1 ? 's' : ''} · {formatMoney(day.revenue)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-light-200/70 cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto divide-y divide-white/10">
          {orders.map((order) => {
            const shortId = order.orderId ? order.orderId.slice(-6) : order.id.slice(-4).toUpperCase()
            const d = orderDate(order)
            const time = d ? d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : '—'
            const preview = Array.isArray(order.items) && order.items.length > 0
              ? order.items.map((it) => `${it.qty > 1 ? `${it.qty}× ` : ''}${it.name}`).join(', ')
              : '—'
            return (
              <div key={order.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                    #{shortId}
                  </span>
                  <span className="text-sm font-bold text-light-100 tabular-nums">{formatMoney(Number(order.revenue || order.total || 0))}</span>
                </div>
                <p className="text-xs text-light-200/65 flex items-center gap-1.5 mb-1">
                  <Clock size={11} /> {time}
                </p>
                <p className="text-xs text-light-200/60 truncate">{preview}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const DailyTrendChart = ({ orders }) => {
  const [selectedKey, setSelectedKey] = useState(null)

  const dailyData = useMemo(() => {
    const byDay = {}
    for (const order of orders) {
      const d = orderDate(order)
      if (!d) continue
      const key = dayKey(d)
      if (!byDay[key]) byDay[key] = { key, label: dayLabel(d), fullLabel: d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }), revenue: 0, cogs: 0 }
      byDay[key].revenue += Number(order.revenue || order.total || 0)
      byDay[key].cogs += Number(order.totalCogs || 0)
    }
    return Object.values(byDay)
      .map((d) => ({ ...d, profit: d.revenue - d.cogs }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [orders])

  const ordersByDay = useMemo(() => {
    const map = {}
    for (const order of orders) {
      const d = orderDate(order)
      if (!d) continue
      const key = dayKey(d)
      if (!map[key]) map[key] = []
      map[key].push(order)
    }
    return map
  }, [orders])

  const selectedDay = selectedKey ? dailyData.find((d) => d.key === selectedKey) : null

  return (
    <div className="bg-main-900 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
          <LineChartIcon size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-light-100">Tendencia Diaria</h3>
          <p className="text-xs text-light-200/65">Ingresos y ganancia por día — toca un punto para ver los pedidos</p>
        </div>
      </div>

      {dailyData.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2 text-light-200/55">
          <LineChartIcon size={32} />
          <p className="text-sm italic">No hay datos en este período.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <div style={{ minWidth: Math.max(dailyData.length * 56, 320), height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailyData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                onClick={(state) => { if (state?.activePayload?.[0]?.payload?.key) setSelectedKey(state.activePayload[0].payload.key) }}
              >
                <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
                <XAxis dataKey="key" tickFormatter={(key) => dailyData.find((d) => d.key === key)?.label ?? key} tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compactPeso} tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-chart-grid)' }} />
                <Legend
                  formatter={(value) => <span className="text-light-200/60 text-xs">{value}</span>}
                  iconType="circle"
                  iconSize={8}
                />
                <Line type="monotone" dataKey="revenue" name="Ingresos" stroke="var(--color-chart-revenue)" strokeWidth={2} dot={{ r: 3, cursor: 'pointer' }} activeDot={{ r: 5, cursor: 'pointer' }} />
                <Line type="monotone" dataKey="profit" name="Ganancia" stroke="var(--color-chart-profit)" strokeWidth={2} dot={{ r: 3, cursor: 'pointer' }} activeDot={{ r: 5, cursor: 'pointer' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {selectedDay && (
        <DayOrdersModal day={selectedDay} orders={ordersByDay[selectedDay.key] || []} onClose={() => setSelectedKey(null)} />
      )}
    </div>
  )
}
