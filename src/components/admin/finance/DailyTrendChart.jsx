/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { formatMoney } from '../../../utils/cart'
import { itemLineTotal, localDayKey, orderDate } from '../../../utils/financeCalculations'
import { LineChart as LineChartIcon, X, Clock, AlertTriangle, Minus, Equal } from 'lucide-react'

const dayLabel = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
const fullLabel = (d) => d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

const compactPeso = (v) => {
  const n = Number(v || 0)
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

const signedMoney = (n) => (n < 0 ? `−${formatMoney(Math.abs(n))}` : formatMoney(n))

const Row = ({ label, value, strong, tone }) => (
  <div className="flex items-center justify-between gap-4">
    <span className={strong ? 'text-light-100 font-semibold' : 'text-light-200/70'}>{label}</span>
    <span className={`tabular-nums font-bold ${tone || 'text-light-100'}`}>{value}</span>
  </div>
)

const TrendTooltip = ({ active, payload, hasExpenses }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-white/10 bg-main-900 px-3.5 py-3 shadow-xl text-xs space-y-1 min-w-[13rem]">
      <p className="font-semibold text-light-100 capitalize mb-1.5">{fullLabel(d.date)}</p>
      <Row label="Vendiste" value={formatMoney(d.revenue)} />
      <Row label="− Ingredientes" value={formatMoney(d.cogs)} />
      {hasExpenses && <Row label="− Gastos fijos del día" value={formatMoney(d.fixedCosts)} />}
      <div className="border-t border-white/10 pt-1 mt-1">
        <Row
          strong
          label={hasExpenses ? 'Te quedó' : 'Ganancia'}
          value={signedMoney(hasExpenses ? d.netProfit : d.grossProfit)}
          tone={(hasExpenses ? d.netProfit : d.grossProfit) < 0 ? 'text-rose-400' : 'text-emerald-400'}
        />
      </div>
      <p className="text-light-200/60 pt-1">
        {d.orderCount === 0 ? 'Sin ventas este día' : `${d.orderCount} pedido${d.orderCount !== 1 ? 's' : ''} · toca para verlos`}
      </p>
    </div>
  )
}

const DayOrdersModal = ({ day, orders, onClose }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pedidos del ${fullLabel(day.date)}`}
      className="bg-main-900 border border-white/10 rounded-3xl w-full max-w-sm max-h-[80vh] shadow-2xl flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
        <div>
          <h3 className="text-sm font-bold text-light-100 capitalize">{fullLabel(day.date)}</h3>
          <p className="text-xs text-light-200/65 mt-0.5">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} · vendiste {formatMoney(day.revenue)} · ganancia {signedMoney(day.grossProfit)}
          </p>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white/5 text-light-200/70 cursor-pointer transition-colors">
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
                <span className="text-sm font-bold text-light-100 tabular-nums">{formatMoney(Number(order.revenue || 0))}</span>
              </div>
              <p className="text-xs text-light-200/65 flex items-center gap-1.5 mb-1">
                <Clock size={11} /> {time}
                <span className="ml-auto">ingredientes {formatMoney(Number(order.totalCogs || 0))}</span>
              </p>
              <p className="text-xs text-light-200/60 truncate">{preview}</p>
            </div>
          )
        })}
      </div>
    </div>
  </div>
)

const Tile = ({ label, value, hint, tone = 'text-light-100', emphasis }) => (
  <div className={`rounded-2xl px-4 py-3 ${emphasis ? 'bg-primary/10 ring-1 ring-primary/25' : 'bg-main-800'}`}>
    <p className="text-xs font-semibold text-light-200/70">{label}</p>
    <p className={`text-xl font-bold tabular-nums mt-0.5 ${tone}`}>{value}</p>
    {hint && <p className="text-[11px] text-light-200/60 mt-0.5 leading-snug">{hint}</p>}
  </div>
)

const Op = ({ icon: Icon }) => (
  <span className="hidden lg:flex items-center justify-center text-light-200/50" aria-hidden="true"><Icon size={18} /></span>
)

// "Día a día" — what was sold and what the café actually kept, every day of
// the selected range. All numbers come from buildDailyTrend/summarizeTrend
// (utils/financeCalculations.js), which are unit-tested.
export const DailyTrendChart = ({ days, summary, orders, hasExpenses, onOpenExpenses }) => {
  const [selectedKey, setSelectedKey] = useState(null)

  const ordersByDay = useMemo(() => {
    const map = {}
    for (const order of orders) {
      const d = orderDate(order)
      if (!d) continue
      const key = localDayKey(d)
      ;(map[key] ||= []).push(order)
    }
    return map
  }, [orders])

  // Products sold without a recipe → their cost is unknown (counted as $0).
  const uncostedProducts = useMemo(() => {
    const byName = {}
    for (const order of orders) {
      for (const item of order.items || []) {
        if (item.totalCost != null) continue
        byName[item.name] = (byName[item.name] || 0) + itemLineTotal(item)
      }
    }
    return Object.entries(byName).sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [orders])

  const chartData = useMemo(() => days.map((d) => ({ ...d, label: dayLabel(d.date) })), [days])
  const selectedDay = selectedKey ? days.find((d) => d.key === selectedKey) : null
  const kept = hasExpenses ? summary.netProfit : summary.grossProfit

  const handleChartClick = (state) => {
    const idx = Number(state?.activeTooltipIndex ?? state?.activeIndex)
    const day = Number.isInteger(idx) ? days[idx] : days.find((d) => d.key === state?.activeLabel)
    if (day?.orderCount > 0) setSelectedKey(day.key)
  }

  return (
    <div className="space-y-4">
      {/* The period as one plain equation */}
      <div className="bg-main-900 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-9 w-9 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <LineChartIcon size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-light-100">¿Cuánto te quedó?</h3>
            <p className="text-sm text-light-200/70">
              Lo que vendiste en el periodo, menos lo que te costaron los ingredientes
              {hasExpenses ? ' y los gastos fijos (renta, sueldos, servicios…).' : '.'}
            </p>
          </div>
        </div>

        <div className={`grid grid-cols-2 gap-2.5 ${hasExpenses ? 'lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]' : 'lg:grid-cols-[1fr_auto_1fr_auto_1fr]'} items-stretch`}>
          <Tile label="Vendiste" value={formatMoney(summary.revenue)} hint={`${summary.orderCount} pedido${summary.orderCount !== 1 ? 's' : ''} pagado${summary.orderCount !== 1 ? 's' : ''}`} />
          <Op icon={Minus} />
          <Tile label="Ingredientes" value={formatMoney(summary.cogs)} hint="Según las recetas de lo que vendiste" />
          {hasExpenses && (
            <>
              <Op icon={Minus} />
              <Tile label="Gastos fijos" value={formatMoney(summary.fixedCosts)} hint={`Lo que corresponde a ${days.length} día${days.length !== 1 ? 's' : ''}`} />
            </>
          )}
          <Op icon={Equal} />
          <Tile
            emphasis
            label={hasExpenses ? 'Te quedó' : 'Ganancia (antes de gastos fijos)'}
            value={signedMoney(kept)}
            tone={kept < 0 ? 'text-rose-400' : 'text-emerald-400'}
            hint={summary.revenue > 0 ? `${Math.round((kept / summary.revenue) * 100)}% de lo vendido` : null}
          />
        </div>

        {!hasExpenses && (
          <p className="mt-3 text-sm text-light-200/75">
            Aún no registras gastos fijos, así que esta ganancia todavía no descuenta renta ni sueldos.{' '}
            <button type="button" onClick={onOpenExpenses} className="font-bold text-primary dark:text-main-300 underline underline-offset-2 cursor-pointer">
              Registrar gastos fijos
            </button>
          </p>
        )}

        {summary.uncostedRevenue > 0 && (
          <div role="note" className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex gap-2.5">
            <AlertTriangle size={17} className="shrink-0 mt-0.5" />
            <p>
              <strong>{formatMoney(summary.uncostedRevenue)} ({Math.round(summary.uncostedShare * 100)}%)</strong> de lo vendido
              es de productos sin receta, así que su costo cuenta como $0 y la ganancia real es menor que la mostrada.
              {uncostedProducts.length > 0 && <> Agrega la receta de: <strong>{uncostedProducts.slice(0, 5).join(', ')}{uncostedProducts.length > 5 ? '…' : ''}</strong> en Inventario → Recetas.</>}
            </p>
          </div>
        )}
      </div>

      {/* Day by day */}
      <div className="bg-main-900 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-light-100">Día a día</h3>
            <p className="text-sm text-light-200/70">Toca un día para ver sus pedidos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-light-200/75">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: 'var(--color-chart-revenue)', opacity: 0.55 }} />Vendiste</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: 'var(--color-chart-profit)' }} />{hasExpenses ? 'Te quedó' : 'Ganancia'}</span>
          </div>
        </div>

        {summary.daysWithSales === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-light-200/55">
            <LineChartIcon size={32} />
            <p className="text-sm">No hay ventas pagadas en este periodo.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: Math.max(days.length * 34, 320), height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={handleChartClick}>
                  <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis tickFormatter={compactPeso} tick={{ fill: 'var(--color-chart-tick)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<TrendTooltip hasExpenses={hasExpenses} />} cursor={{ fill: 'var(--color-chart-cursor)' }} />
                  <ReferenceLine y={0} stroke="var(--color-chart-tick)" strokeOpacity={0.5} />
                  <Bar dataKey="revenue" name="Vendiste" fill="var(--color-chart-revenue)" fillOpacity={0.55} radius={[6, 6, 0, 0]} maxBarSize={28} cursor="pointer" />
                  <Line
                    type="linear"
                    dataKey={hasExpenses ? 'netProfit' : 'grossProfit'}
                    name={hasExpenses ? 'Te quedó' : 'Ganancia'}
                    stroke="var(--color-chart-profit)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5, cursor: 'pointer' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {selectedDay && (
        <DayOrdersModal day={selectedDay} orders={ordersByDay[selectedDay.key] || []} onClose={() => setSelectedKey(null)} />
      )}
    </div>
  )
}
