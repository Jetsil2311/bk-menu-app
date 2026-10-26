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
import {
  Calendar, DollarSign, Package, TrendingUp, ShoppingBag, Receipt, AlertTriangle, Wallet,
} from 'lucide-react'

const RANGE_OPTIONS = [
  { key: 'today',  label: 'Hoy' },
  { key: 'week',   label: 'Esta Semana' },
  { key: 'month',  label: 'Este Mes' },
  { key: 'last30', label: 'Últimos 30 Días' },
  { key: 'custom', label: 'Personalizado' },
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

const MetricCard = ({ icon: Icon, label, value, subtext, colorCls, valueCls = 'text-light-100' }) => (
  <div className="bg-main-900 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm flex items-start gap-4 sm:gap-5">
    <div className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center shrink-0 ${colorCls}`}>
      <Icon size={22} />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-light-200/75">{label}</p>
      <h4 className={`text-xl sm:text-2xl font-bold mt-0.5 tabular-nums truncate ${valueCls}`}>{value}</h4>
      {subtext && <p className="text-xs text-light-200/65 mt-1 leading-snug">{subtext}</p>}
    </div>
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

  const activeLabel = RANGE_OPTIONS.find((o) => o.key === rangeKey)?.label ?? 'Este Mes'

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={16} className="text-light-200/65 shrink-0" />
          <div className="flex items-center gap-1 p-1 rounded-xl bg-main-900 border border-white/10 flex-wrap">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRangeKey(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  rangeKey === opt.key ? 'bg-main-500 text-snow' : 'text-light-200/70 hover:text-light-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {rangeKey === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 bg-main-900 border border-white/10 rounded-2xl p-4">
            <div>
              <label className="block text-xs font-medium text-light-200/60 mb-1.5">Desde</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-xl border border-white/10 bg-main-900 px-3 py-2 text-sm text-light-100 outline-none focus:border-main-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-light-200/60 mb-1.5">Hasta</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-xl border border-white/10 bg-main-900 px-3 py-2 text-sm text-light-100 outline-none focus:border-main-500/50 transition-colors"
              />
            </div>
            <button
              onClick={handleApplyCustom}
              className="px-4 py-2 rounded-xl bg-main-500 hover:bg-main-400 text-snow text-sm font-semibold transition-colors cursor-pointer"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl bg-main-900 border border-white/10 flex-wrap w-fit">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === tab.key ? 'bg-main-500 text-snow' : 'text-light-200/70 hover:text-light-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-light-200/75 -mt-2 max-w-3xl">
        {TAB_OPTIONS.find((t) => t.key === activeTab)?.help}
      </p>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <MetricCard
                icon={DollarSign}
                label="Vendiste"
                value={formatMoney(metrics.totalRevenue)}
                subtext={`Lo que pagaron tus clientes en ${metrics.orderCount} pedido${metrics.orderCount !== 1 ? 's' : ''} (${activeLabel.toLowerCase()}).`}
                colorCls="bg-emerald-500/10 text-emerald-400"
              />
              <MetricCard
                icon={Package}
                label="Te costaron los ingredientes"
                value={formatMoney(metrics.totalCogs)}
                subtext="Calculado con las recetas de cada producto vendido."
                colorCls="bg-amber-500/10 text-amber-400"
              />
              <MetricCard
                icon={TrendingUp}
                label="Ganancia antes de gastos fijos"
                value={formatMoney(metrics.grossProfit)}
                subtext={`Vendiste − ingredientes. Es el ${metrics.profitMargin.toFixed(0)}% de lo vendido.`}
                colorCls="bg-blue-500/10 text-blue-400"
              />
              <MetricCard
                icon={Wallet}
                label="Te quedó"
                value={hasExpenses ? formatMoney(trendSummary.netProfit) : '—'}
                valueCls={hasExpenses && trendSummary.netProfit < 0 ? 'text-rose-400' : 'text-light-100'}
                subtext={hasExpenses
                  ? `Después de ${formatMoney(trendSummary.fixedCosts)} de gastos fijos (renta, sueldos…) de estos días.`
                  : 'Registra tus gastos fijos en la pestaña Gastos fijos para ver tu ganancia real.'}
                colorCls="bg-purple-500/10 text-purple-400"
              />
              <MetricCard
                icon={ShoppingBag}
                label="Pedidos pagados"
                value={metrics.orderCount.toLocaleString('es-MX')}
                subtext="No cuenta pedidos cancelados, reembolsados ni pendientes de cobro."
                colorCls="bg-white/10 text-light-200"
              />
              <MetricCard
                icon={Receipt}
                label="Ticket promedio"
                value={formatMoney(metrics.avgOrderValue)}
                subtext="Lo que gasta en promedio cada cliente por pedido."
                colorCls="bg-teal-500/10 text-teal-400"
              />
            </div>

            {trendSummary.uncostedRevenue > 0 && hasAnyRecipe && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  {formatMoney(trendSummary.uncostedRevenue)} de lo vendido es de productos sin receta: su costo cuenta como $0,
                  así que la ganancia real es menor. Ve a <strong>Día a día</strong> para ver cuáles son.
                </span>
              </div>
            )}

            {!hasAnyRecipe && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>Todavía no hay recetas, así que no se puede saber cuánto te cuestan tus productos. Crea las recetas en Inventario → Recetas.</span>
              </div>
            )}
            {hasAnyRecipe && anyEstimated && (
              <p className="text-xs text-light-200/65 px-1">
                Algunos pedidos de este período son de antes de que se registrara el costo por venta — su ganancia se estima con las recetas actuales, no con el costo real de ese día.
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
