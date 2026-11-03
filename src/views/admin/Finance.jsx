/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { formatMoney } from '../../utils/cart'
import { isPaidOrderStatus } from '../../utils/orderStatus'
import {
  enrichOrderFinancials,
  buildDailyTrend,
  buildDocIdByLegacyIdMap,
  buildNameToDocIdMap,
  orderDate,
  summarizeTrend,
} from '../../utils/financeCalculations'
import { fixedCostForDay } from '../../utils/expenses'
import { useExpenses } from '../../hooks/useExpenses'
import { DailyTrendChart } from '../../components/admin/finance/DailyTrendChart'
import { ProductProfitability } from '../../components/admin/finance/ProductProfitability'
import { BreakEvenAnalysis } from '../../components/admin/finance/BreakEvenAnalysis'
import { StockVariance } from '../../components/admin/finance/StockVariance'
import { SupplierAnalysis } from '../../components/admin/finance/SupplierAnalysis'
import { ProfitByDayOfWeek } from '../../components/admin/finance/ProfitByDayOfWeek'
import { Receipt, AlertTriangle } from 'lucide-react'
import { TabBar, FilterPills, StatStrip } from '../../components/admin/ui'

const RANGE_OPTIONS = [
  { key: 'today',  label: 'Hoy' },
  { key: 'week',   label: 'Semana' },
  { key: 'month',  label: 'Mes' },
  { key: 'last30', label: '30 días' },
  { key: 'custom', label: 'Fechas…' },
]

// Keys are saved in localStorage — keep them; only labels/help changed.
const TAB_OPTIONS = [
  { key: 'resumen',     label: 'Resumen',           help: 'Lo más importante del periodo: cuánto vendiste, cuánto te costó y cuánto ganaste.' },
  { key: 'tendencia',   label: 'Día a día',         help: 'Cuánto vendiste y cuánto te quedó cada día, ya descontando ingredientes y gastos fijos.' },
  { key: 'productos',   label: 'Por producto',      help: 'Qué productos te dejan más ganancia y cuáles casi no te dejan nada.' },
  { key: 'equilibrio',  label: 'Gastos fijos',      help: 'Registra renta, sueldos y servicios, y ve cuánto necesitas vender hoy para cubrirlos. Usa solo las ventas de hoy.' },
  { key: 'inventario',  label: 'Consumo de insumos', help: 'Compara lo que deberían haber costado tus ventas según las recetas contra lo que se registró al cobrar.' },
  { key: 'proveedores', label: 'Compras',           help: 'Cuánto le compraste a cada proveedor en el periodo (de las entradas de Inventario).' },
  { key: 'pordia',      label: 'Días de la semana', help: 'Qué días de la semana vendes y ganas más, para planear horarios y promociones.' },
]

const TAB_STORAGE_KEY = 'bk_finance_tab'
const RANGE_STORAGE_KEY = 'bk_finance_range'
const CUSTOM_START_KEY = 'bk_finance_custom_start'
const CUSTOM_END_KEY = 'bk_finance_custom_end'

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

// Local YYYY-MM-DD — avoids the UTC-shift pitfall Metrics.jsx already had to fix once
// (toISOString() reports the UTC date, which can land on the wrong calendar day here).
const toInputDate = (d) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')

const getRangeBounds = (rangeKey, customStart, customEnd) => {
  const now = new Date()
  if (rangeKey === 'today') return { start: startOfDay(now), end: endOfDay(now) }
  if (rangeKey === 'week') {
    const diffToMonday = (now.getDay() + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - diffToMonday)
    return { start: startOfDay(monday), end: endOfDay(now) }
  }
  if (rangeKey === 'last30') {
    const d = new Date(now)
    d.setDate(d.getDate() - 29)
    return { start: startOfDay(d), end: endOfDay(now) }
  }
  if (rangeKey === 'custom' && customStart && customEnd) {
    return { start: startOfDay(new Date(`${customStart}T00:00:00`)), end: endOfDay(new Date(`${customEnd}T00:00:00`)) }
  }
  // 'month' and fallback
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  return { start: startOfDay(first), end: endOfDay(now) }
}

// One line of the "where did the money go" card.
const FlowRow = ({ label, value, sign, strong = false, valueCls = 'text-light-100' }) => (
  <div className={`flex items-baseline justify-between gap-4 py-3 ${strong ? 'border-t border-white/10 pt-4' : ''}`}>
    <dt className={strong ? 'text-base font-bold text-light-100' : 'text-sm font-semibold text-light-200/75'}>{label}</dt>
    <dd className={`tabular-nums font-bold ${strong ? 'font-display text-3xl sm:text-4xl' : 'text-lg'} ${valueCls}`}>
      {sign && <span className="mr-1 text-light-200/50">{sign}</span>}
      {value}
    </dd>
  </div>
)

export const Finance = () => {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem(TAB_STORAGE_KEY)
      return TAB_OPTIONS.some((t) => t.key === saved) ? saved : 'resumen'
    } catch { return 'resumen' }
  })
  const [rangeKey, setRangeKey] = useState(() => {
    try { return localStorage.getItem(RANGE_STORAGE_KEY) || 'month' } catch { return 'month' }
  })
  const [customStart, setCustomStart] = useState(() => {
    try { return localStorage.getItem(CUSTOM_START_KEY) || toInputDate(new Date()) } catch { return toInputDate(new Date()) }
  })
  const [customEnd, setCustomEnd] = useState(() => {
    try { return localStorage.getItem(CUSTOM_END_KEY) || toInputDate(new Date()) } catch { return toInputDate(new Date()) }
  })
  const [appliedCustom, setAppliedCustom] = useState({ start: customStart, end: customEnd })

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [recipes, setRecipes] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    try { localStorage.setItem(RANGE_STORAGE_KEY, rangeKey) } catch { /* noop */ }
  }, [rangeKey])

  useEffect(() => {
    try { localStorage.setItem(TAB_STORAGE_KEY, activeTab) } catch { /* noop */ }
  }, [activeTab])

  // Real-time listener over all orders, filtered client-side (status + date range) —
  // matches Metrics.jsx's own approach of not filtering server-side, so no composite
  // Firestore index is required. Order volume for a single café is small enough that
  // this is the pragmatic choice here.
  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (cancelled) return
      unsub = onSnapshot(
        collection(db, 'orders'),
        (snap) => {
          if (!alive) return
          setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
          setLoading(false)
          setLoadError('')
        },
        () => {
          if (!alive) return
          setLoadError('Error cargando datos financieros.')
          setLoading(false)
        }
      )
    }, 0)
    return () => {
      cancelled = true
      alive = false
      clearTimeout(timer)
      if (unsub) try { unsub() } catch { /* noop */ }
    }
  }, [])

  // recipes needs to be real-time (an admin can edit ingredient costs at any time) and
  // full (not just an existence check) — it now also drives the retroactive-COGS estimate
  // below for orders that predate real per-order cost tracking.
  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (cancelled) return
      unsub = onSnapshot(
        collection(db, 'recipes'),
        (snap) => { if (alive) setRecipes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))) },
        () => { /* non-fatal — hasAnyRecipe/estimates just fall back to "no recipe data" */ }
      )
    }, 0)
    return () => {
      cancelled = true
      alive = false
      clearTimeout(timer)
      if (unsub) try { unsub() } catch { /* noop */ }
    }
  }, [])

  // products maps a legacy numeric `id` (the pre-Firestore identifier still carried by
  // order line items written before productDocId existed on the cart) back to the
  // Firestore doc id that `recipes` is actually keyed by — needed to estimate cost on
  // pre-2026-08-03 orders. A one-time fetch is enough since this association is set at
  // product creation and effectively never changes afterward.
  useEffect(() => {
    let alive = true
    getDocs(collection(db, 'products'))
      .then((snap) => { if (alive) setProducts(snap.docs.map((d) => ({ docId: d.id, ...d.data() }))) })
      .catch(() => { /* non-fatal — legacy-id resolution just won't find a match */ })
    return () => { alive = false }
  }, [])

  const recipesById = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes])
  const docIdByLegacyId = useMemo(() => buildDocIdByLegacyIdMap(products), [products])
  const nameToDocId = useMemo(() => buildNameToDocIdMap(products), [products])
  const hasAnyRecipe = recipes.length > 0

  const { start, end } = useMemo(
    () => getRangeBounds(rangeKey, appliedCustom.start, appliedCustom.end),
    [rangeKey, appliedCustom]
  )

  // Single enrichment pass: revenue from line items (not raw order.total), COGS from
  // recorded costs or current-recipe estimates, profit = revenue - COGS. Every Finance
  // tab reads these patched fields so all numbers stay consistent.
  const ordersWithCogs = useMemo(() => (
    orders.map((o) => enrichOrderFinancials(o, recipesById, docIdByLegacyId, nameToDocId))
  ), [orders, recipesById, docIdByLegacyId, nameToDocId])

  // Shared by the metric cards, the daily trend chart, and the product profitability
  // table below — all three read the exact same paid+in-range order set, so this is
  // computed once here rather than each section re-filtering `orders` on its own.
  const paidInRange = useMemo(() => {
    return ordersWithCogs.filter((o) => {
      if (!isPaidOrderStatus(o.status)) return false
      const d = orderDate(o)
      return d && d >= start && d <= end
    })
  }, [ordersWithCogs, start, end])

  const anyEstimated = useMemo(() => paidInRange.some((o) => o.costEstimated), [paidInRange])

  // Day-by-day money incl. fixed expenses — shared by Resumen and Día a día.
  const expenses = useExpenses()
  const hasExpenses = expenses.length > 0
  const trendDays = useMemo(
    () => buildDailyTrend(paidInRange, { start, end, fixedCostForDay: (d) => fixedCostForDay(expenses, d) }),
    [paidInRange, start, end, expenses]
  )
  const trendSummary = useMemo(() => summarizeTrend(trendDays), [trendDays])

  const metrics = useMemo(() => {
    const totalRevenue = paidInRange.reduce((sum, o) => sum + Number(o.revenue || 0), 0)
    const totalCogs = paidInRange.reduce((sum, o) => sum + Number(o.totalCogs || 0), 0)
    const grossProfit = totalRevenue - totalCogs
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const orderCount = paidInRange.length
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0
    return { totalRevenue, totalCogs, grossProfit, profitMargin, orderCount, avgOrderValue }
  }, [paidInRange])

  const handleApplyCustom = () => {
    setAppliedCustom({ start: customStart, end: customEnd })
    try {
      localStorage.setItem(CUSTOM_START_KEY, customStart)
      localStorage.setItem(CUSTOM_END_KEY, customEnd)
    } catch { /* noop */ }
  }


  return (
    <div className="space-y-5">
      <TabBar tabs={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} ariaLabel="Vistas de finanzas" />

      <div className="space-y-3">
        <FilterPills options={RANGE_OPTIONS} value={rangeKey} onChange={setRangeKey} ariaLabel="Periodo" />
        {rangeKey === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 bg-main-900 border border-white/10 rounded-2xl p-4">
            <div>
              <label htmlFor="fin-from" className="block text-sm font-semibold text-light-200/75 mb-1.5">Desde</label>
              <input
                id="fin-from"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="min-h-[44px] rounded-xl border border-white/15 bg-main-900 px-3 text-sm text-light-100 outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label htmlFor="fin-to" className="block text-sm font-semibold text-light-200/75 mb-1.5">Hasta</label>
              <input
                id="fin-to"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="min-h-[44px] rounded-xl border border-white/15 bg-main-900 px-3 text-sm text-light-100 outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              onClick={handleApplyCustom}
              className="min-h-[44px] px-4 rounded-xl bg-primary hover:bg-secondary text-snow text-sm font-bold transition-colors cursor-pointer"
            >
              Aplicar
            </button>
          </div>
        )}
        {activeTab !== 'resumen' && (
          <p className="text-sm text-light-200/65 max-w-3xl">
            {TAB_OPTIONS.find((t) => t.key === activeTab)?.help}
          </p>
        )}
      </div>

      {loadError && (
        <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-main-900 border border-white/10 rounded-3xl p-6 h-24 animate-pulse" />
          ))}
        </div>
      ) : activeTab === 'resumen' ? (
        metrics.orderCount === 0 ? (
          <div className="bg-main-900 border border-white/10 rounded-3xl py-16 flex flex-col items-center gap-3 text-light-200/55">
            <Receipt size={40} />
            <p className="text-sm italic text-center max-w-sm px-4">
              No hay pedidos completados en este período.<br />Completa algunos pedidos para ver tus métricas.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
              {/* The money story: sold − ingredients − fixed costs = what's left */}
              <dl className="rounded-2xl border border-white/10 bg-main-900 px-5 py-2 sm:px-6">
                <FlowRow label="Vendiste" value={formatMoney(metrics.totalRevenue)} />
                <FlowRow label="Ingredientes" sign="−" value={formatMoney(metrics.totalCogs)} />
                {hasExpenses ? (
                  <>
                    <FlowRow label="Gastos fijos" sign="−" value={formatMoney(trendSummary.fixedCosts)} />
                    <FlowRow
                      strong
                      label="Te quedó"
                      value={formatMoney(trendSummary.netProfit)}
                      valueCls={trendSummary.netProfit < 0 ? 'text-rose-400' : 'text-emerald-400'}
                    />
                  </>
                ) : (
                  <>
                    <FlowRow strong label="Ganancia" value={formatMoney(metrics.grossProfit)} />
                    <p className="pb-3 text-xs text-light-200/65">
                      Sin gastos fijos (renta, sueldos…).{' '}
                      <button type="button" onClick={() => setActiveTab('equilibrio')} className="font-bold text-primary dark:text-main-300 hover:underline cursor-pointer">
                        Agrégalos
                      </button>{' '}
                      para ver lo que de verdad te quedó.
                    </p>
                  </>
                )}
              </dl>

              <StatStrip
                items={[
                  { label: 'Pedidos pagados', value: metrics.orderCount.toLocaleString('es-MX') },
                  { label: 'Ticket promedio', value: formatMoney(metrics.avgOrderValue) },
                  { label: 'Margen', value: `${metrics.profitMargin.toFixed(0)}%`, hint: 'de lo vendido, tras ingredientes' },
                ]}
              />
            </div>
            {trendSummary.uncostedRevenue > 0 && hasAnyRecipe && (
              <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-400 flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  {formatMoney(trendSummary.uncostedRevenue)} vendidos no tienen receta, así que la ganancia real es menor.{' '}
                  <button type="button" onClick={() => setActiveTab('tendencia')} className="underline cursor-pointer">Ver cuáles</button>
                </span>
              </div>
            )}

            {!hasAnyRecipe && (
              <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-400 flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>Sin recetas no se sabe cuánto te cuesta cada producto. Créalas en Inventario → Recetas.</span>
              </div>
            )}
            {hasAnyRecipe && anyEstimated && (
              <p className="text-xs text-light-200/65 px-1">
                Algunos pedidos son de antes de que se guardara el costo por venta; su costo se estima con las recetas actuales.
              </p>
            )}
          </>
        )
      ) : activeTab === 'tendencia' ? (
        <DailyTrendChart
          days={trendDays}
          summary={trendSummary}
          orders={paidInRange}
          hasExpenses={hasExpenses}
          onOpenExpenses={() => setActiveTab('equilibrio')}
        />
      ) : activeTab === 'productos' ? (
        <ProductProfitability orders={paidInRange} />
      ) : activeTab === 'equilibrio' ? (
        <BreakEvenAnalysis orders={ordersWithCogs} hasAnyRecipe={hasAnyRecipe} />
      ) : activeTab === 'inventario' ? (
        <StockVariance orders={paidInRange} docIdByLegacyId={docIdByLegacyId} nameToDocId={nameToDocId} />
      ) : activeTab === 'proveedores' ? (
        <SupplierAnalysis start={start} end={end} />
      ) : (
        <ProfitByDayOfWeek orders={paidInRange} start={start} end={end} />
      )}
    </div>
  )
}
