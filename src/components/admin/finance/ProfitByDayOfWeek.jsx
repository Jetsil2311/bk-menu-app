import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts'
import { formatMoney } from '../../../utils/cart'
import { orderDate } from '../../../utils/financeCalculations'
import { CalendarDays, TrendingUp, TrendingDown, Minus, BarChart2, ChevronDown, ChevronUp } from 'lucide-react'

const DAY_NAMES  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_SHORT  = ['Dom',     'Lun',   'Mar',    'Mié',       'Jue',    'Vie',     'Sáb'   ]
// Mon-first display order (indices into DAY_NAMES / DAY_SHORT)
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const compactPeso = (v) => {
  const n = Number(v || 0)
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

const StatCard = ({ icon: Icon, label, value, subtext, colorCls }) => (
  <div className="bg-main-900 border border-white/10 rounded-3xl p-5 shadow-sm">
    <div className={`h-9 w-9 rounded-2xl flex items-center justify-center shrink-0 mb-3 ${colorCls}`}>
      <Icon size={18} />
    </div>
    <p className="text-xs font-medium text-light-200/65 uppercase tracking-wider truncate">{label}</p>
    <h4 className="text-xl sm:text-2xl font-bold text-light-100 mt-1 tabular-nums truncate">{value}</h4>
    {subtext && <p className="text-[10px] text-light-200/55 mt-0.5 truncate">{subtext}</p>}
  </div>
)

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { dayName, avgRevenue, avgProfit, avgOrders, margin } = payload[0].payload
  return (
    <div className="rounded-xl border border-white/10 bg-main-950 px-3 py-2.5 shadow-xl text-xs space-y-1.5 min-w-[10rem]">
      <p className="font-semibold text-light-100">{dayName}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-light-200/70 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-400" />Ingresos
        </span>
        <span className="font-bold text-light-100 tabular-nums">{formatMoney(avgRevenue)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-light-200/70 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />Ganancia
        </span>
        <span className="font-bold text-light-100 tabular-nums">{formatMoney(avgProfit)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-light-200/70">Pedidos prom.</span>
        <span className="font-bold text-light-100 tabular-nums">{Math.round(avgOrders)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-light-200/70">Margen</span>
        <span className="font-bold text-light-100 tabular-nums">{margin.toFixed(1)}%</span>
      </div>
    </div>
  )
}

const TABLE_COLS = [
  { key: 'dayName',    label: 'Día',           align: 'left'  },
  { key: 'avgRevenue', label: 'Ing. Promedio',  align: 'right' },
  { key: 'avgProfit',  label: 'Gan. Promedio',  align: 'right' },
  { key: 'avgOrders',  label: 'Pedidos Prom.',  align: 'right' },
  { key: 'margin',     label: 'Margen %',       align: 'right' },
]

// Green for top 3 days, red for bottom 3, amber for the middle
const profitBarColor = (rank) => {
  if (rank <= 2) return 'var(--color-chart-good)'
  if (rank >= 4) return 'var(--color-chart-bad)'
  return 'var(--color-chart-mid)'
}

export const ProfitByDayOfWeek = ({ orders, start, end }) => {
  const [tableOpen, setTableOpen] = useState(false)
  const [sort, setSort]           = useState({ key: 'avgProfit', dir: 'desc' })

  const dayData = useMemo(() => {
    const map = {}
    for (let i = 0; i < 7; i++) {
      map[i] = { dayIndex: i, dayName: DAY_NAMES[i], dayShort: DAY_SHORT[i], revenue: 0, cogs: 0, orderCount: 0 }
    }
    for (const order of orders) {
      const d = orderDate(order)
      if (!d) continue
      const dow = d.getDay()
      map[dow].revenue    += Number(order.revenue || order.total || 0)
      map[dow].cogs       += Number(order.totalCogs || 0)
      map[dow].orderCount += 1
    }
    const rangeMs      = end - start
    const weeksInRange = Math.max(1, Math.ceil(rangeMs / (7 * 24 * 60 * 60 * 1000)))

    return Object.values(map).map((day) => {
      const profit = day.revenue - day.cogs
      return {
        ...day,
        avgRevenue: Math.round(day.revenue  / weeksInRange),
        avgProfit:  Math.round(profit       / weeksInRange),
        avgOrders:  day.orderCount / weeksInRange,
        margin:     day.revenue > 0 ? ((day.revenue - day.cogs) / day.revenue) * 100 : 0,
      }
    })
  }, [orders, start, end])

  // Rank days 0=best … 6=worst by avgProfit (for color + summary cards)
  const rankedByProfit = useMemo(
    () => [...dayData].sort((a, b) => b.avgProfit - a.avgProfit),
    [dayData]
  )
  const rankMap = useMemo(
    () => Object.fromEntries(rankedByProfit.map((d, i) => [d.dayIndex, i])),
    [rankedByProfit]
  )

  const bestDay  = rankedByProfit[0]
  const worstDay = rankedByProfit[6]
  const avgProfit = Math.round(dayData.reduce((s, d) => s + d.avgProfit, 0) / 7)
  const diff      = bestDay.avgProfit - worstDay.avgProfit

  // Chart data in Mon-first order, each bar colored by rank
  const chartData = WEEK_ORDER.map((i) => ({
    ...dayData[i],
    _rank: rankMap[i],
  }))

  const toggleSort = (key) => setSort((p) => p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })

  const sortedTable = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...dayData].sort((a, b) => {
      if (sort.key === 'dayName') return a.dayName.localeCompare(b.dayName) * dir
      return (a[sort.key] - b[sort.key]) * dir
    })
  }, [dayData, sort])

  if (orders.length === 0) {
    return (
      <div className="bg-main-900 border border-white/10 rounded-3xl py-16 flex flex-col items-center gap-3 text-light-200/55">
        <BarChart2 size={36} />
        <p className="text-sm italic text-center px-4">
          No hay pedidos en este período para calcular patrones por día.
        </p>
      </div>
    )
  }

  const insight = (() => {
    const ratio = worstDay.avgProfit > 0 ? (bestDay.avgProfit / worstDay.avgProfit) : null
    const lines = []
    if (ratio && ratio > 1.5) {
      lines.push(`${bestDay.dayName}s generan ${ratio.toFixed(1)}× más ganancia que ${worstDay.dayName}s.`)
    }
    if (bestDay.dayIndex === 5 || bestDay.dayIndex === 6) {
      lines.push(`Considera más staff los ${bestDay.dayName}s para maximizar ingresos.`)
    }
    if (worstDay.avgProfit < avgProfit * 0.7) {
      lines.push(`${worstDay.dayName}s bajo promedio — ¿promoción especial?`)
    }
    return lines
  })()

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Mejor día"
          value={bestDay.dayShort}
          subtext={`${formatMoney(bestDay.avgProfit)} promedio`}
          colorCls="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          icon={TrendingDown}
          label="Día más flojo"
          value={worstDay.dayShort}
          subtext={`${formatMoney(worstDay.avgProfit)} promedio`}
          colorCls="bg-rose-500/10 text-rose-400"
        />
        <StatCard
          icon={Minus}
          label="Diferencia"
          value={formatMoney(diff)}
          subtext="Entre mejor y peor día"
          colorCls="bg-amber-500/10 text-amber-400"
        />
        <StatCard
          icon={CalendarDays}
          label="Un día normal"
          value={formatMoney(avgProfit)}
          subtext="Ganancia promedio"
          colorCls="bg-blue-500/10 text-blue-400"
        />
      </div>

      {/* Bar chart */}
      <div className="bg-main-900 border border-white/10 rounded-3xl p-5 sm:p-6">
        <p className="text-sm font-bold text-light-100 mb-5">Ganancia e ingresos promedio por día</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
            <XAxis
              dataKey="dayShort"
              tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={compactPeso}
              tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-chart-cursor)' }} />
            <Legend
              formatter={(value) => (
                <span style={{ color: 'var(--color-chart-tick)', fontSize: 11 }}>{value}</span>
              )}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="avgRevenue" name="Ingresos" fill="var(--color-chart-profit)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="avgProfit"  name="Ganancia" radius={[5, 5, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.dayIndex} fill={profitBarColor(entry._rank)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-light-200/55 mt-2 text-right">
          Verde = top 3 días · Rojo = peor 3 días
        </p>
      </div>

      {/* Insights */}
      {insight.length > 0 && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 space-y-1">
          {insight.map((line, i) => (
            <p key={i} className="text-sm text-blue-300">{line}</p>
          ))}
        </div>
      )}

      {/* Drill-down table */}
      <div className="bg-main-900 border border-white/10 rounded-3xl shadow-sm overflow-hidden">
        <button
          onClick={() => setTableOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 sm:px-6 py-4 cursor-pointer hover:bg-white/3 transition-colors"
        >
          <span className="text-sm font-bold text-light-100">Desglose por día</span>
          {tableOpen ? <ChevronUp size={18} className="text-light-200/65" /> : <ChevronDown size={18} className="text-light-200/65" />}
        </button>

        {tableOpen && (
          <div className="overflow-x-auto px-5 sm:px-6 pb-5 sm:pb-6">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-white/10">
                  {TABLE_COLS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`py-2.5 text-xs font-medium text-light-200/65 uppercase tracking-wider cursor-pointer select-none hover:text-light-200/70 transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                        {col.label}
                        {sort.key === col.key && (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sortedTable.map((day) => {
                  const rank = rankMap[day.dayIndex]
                  const isBest  = rank === 0
                  const isWorst = rank === 6
                  return (
                    <tr key={day.dayIndex} className={`transition-colors ${isBest ? 'bg-emerald-500/5' : isWorst ? 'bg-rose-500/5' : 'hover:bg-white/3'}`}>
                      <td className="py-3 pr-3 font-medium text-light-100">
                        <span className="flex items-center gap-2">
                          {day.dayName}
                          {isBest  && <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">Mejor</span>}
                          {isWorst && <span className="text-[10px] font-bold bg-rose-500/20    text-rose-400    px-1.5 py-0.5 rounded-full">Peor</span>}
                        </span>
                      </td>
                      <td className="py-3 text-right text-light-200/70 tabular-nums">{formatMoney(day.avgRevenue)}</td>
                      <td className={`py-3 text-right font-semibold tabular-nums ${isBest ? 'text-emerald-400' : isWorst ? 'text-rose-400' : 'text-light-100'}`}>
                        {formatMoney(day.avgProfit)}
                      </td>
                      <td className="py-3 text-right text-light-200/70 tabular-nums">{day.avgOrders.toFixed(1)}</td>
                      <td className="py-3 text-right text-light-200/70 tabular-nums">{day.margin.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
