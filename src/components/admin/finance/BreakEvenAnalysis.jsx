import { useMemo, useState } from 'react'
import { formatMoney } from '../../../utils/cart'
import { isPaidOrderStatus } from '../../../utils/orderStatus'
import { orderDate } from '../../../utils/financeCalculations'
import { ExpenseManager } from './ExpenseManager'
import { Scale, Target, ShoppingBag, Flag, AlertTriangle } from 'lucide-react'

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

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

// Break-even is inherently a "today" question ("how many more orders until today
// covers its fixed costs") — it deliberately ignores the date-range selector above
// (Finance 1), which is meant for the other sections. `orders` here is the full,
// unfiltered list already held by Finance.jsx, filtered to today locally.
export const BreakEvenAnalysis = ({ orders, hasAnyRecipe }) => {
  const [expenseTotals, setExpenseTotals] = useState({ dailyFixedCosts: 0, monthlyTotal: 0, annualTotal: 0, count: 0 })
  const fixedCosts = expenseTotals.dailyFixedCosts
  const hasExpenses = expenseTotals.count > 0

  const todayOrders = useMemo(() => {
    const start = startOfDay(new Date())
    const end = endOfDay(new Date())
    return orders.filter((o) => {
      if (!isPaidOrderStatus(o.status)) return false
      const d = orderDate(o)
      return d && d >= start && d <= end
    })
  }, [orders])

  const stats = useMemo(() => {
    const completedOrdersToday = todayOrders.length
    const totalRevenueToday = todayOrders.reduce((s, o) => s + Number(o.revenue || o.total || 0), 0)
    const totalCostsToday = todayOrders.reduce((s, o) => s + Number(o.totalCogs || 0), 0)
    const profitToday = totalRevenueToday - totalCostsToday
    const averageProfitPerOrder = completedOrdersToday > 0 ? profitToday / completedOrdersToday : 0
    const averageOrderValue = completedOrdersToday > 0 ? totalRevenueToday / completedOrdersToday : 0

    const canCalculate = hasExpenses && averageProfitPerOrder > 0
    const breakEvenOrders = canCalculate ? Math.ceil(fixedCosts / averageProfitPerOrder) : null
    const breakEvenRevenue = canCalculate ? breakEvenOrders * averageOrderValue : null
    const revenueNeeded = canCalculate ? Math.max(0, breakEvenRevenue - totalRevenueToday) : null
    const isBreakEven = canCalculate && revenueNeeded <= 0.005
    const progressPct = canCalculate && breakEvenOrders > 0
      ? Math.min(100, (completedOrdersToday / breakEvenOrders) * 100)
      : 0

    return {
      completedOrdersToday, totalRevenueToday, averageProfitPerOrder,
      canCalculate, breakEvenOrders, breakEvenRevenue, revenueNeeded, isBreakEven, progressPct,
    }
  }, [todayOrders, fixedCosts, hasExpenses])

  const profitColorCls = !stats.canCalculate
    ? 'text-light-200/65'
    : stats.averageProfitPerOrder < 0
    ? 'text-rose-400'
    : stats.averageProfitPerOrder >= 50
    ? 'text-emerald-400'
    : 'text-light-200/70'

  return (
    <div className="space-y-5">
      {!hasAnyRecipe && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Sin recetas definidas, el costo de cada pedido se registra como $0 — la ganancia y el punto de equilibrio de abajo son optimistas hasta que definas recetas en Stock → Recetas.</span>
        </div>
      )}

      <ExpenseManager onTotalsChange={setExpenseTotals} />

      {hasExpenses && (
        <p className="text-xs text-light-200/65 px-1">
          Costo fijo diario usado en el cálculo de abajo: <span className="text-light-100 font-semibold">{formatMoney(fixedCosts)}</span> (de tus gastos fijos registrados arriba).
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          icon={Target}
          label="Órdenes para Equilibrio"
          value={stats.canCalculate ? `${stats.breakEvenOrders} órdenes` : 'N/D'}
          subtext={stats.canCalculate ? undefined : !hasExpenses ? 'Agrega tus gastos fijos arriba' : 'Sin ganancia registrada hoy aún'}
          colorCls="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          icon={Scale}
          label="Ingresos para Equilibrio"
          value={stats.canCalculate ? formatMoney(stats.breakEvenRevenue) : 'N/D'}
          colorCls="bg-purple-500/10 text-purple-400"
        />
        <StatCard
          icon={ShoppingBag}
          label="Órdenes Completadas Hoy"
          value={stats.completedOrdersToday.toLocaleString('es-MX')}
          subtext={formatMoney(stats.totalRevenueToday)}
          colorCls="bg-white/10 text-light-200"
        />
        <StatCard
          icon={Flag}
          label="Estado"
          value={!stats.canCalculate ? 'Sin datos aún' : stats.isBreakEven ? '✓ Equilibrio alcanzado' : `Falta ${formatMoney(stats.revenueNeeded)}`}
          colorCls={!stats.canCalculate ? 'bg-white/10 text-light-200/70' : stats.isBreakEven ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}
        />
      </div>

      <div className="bg-main-900 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-light-200/60">
            {stats.canCalculate
              ? `${stats.completedOrdersToday} / ${stats.breakEvenOrders} órdenes`
              : `${stats.completedOrdersToday} órdenes hoy`}
          </span>
          <span className={`font-semibold ${profitColorCls}`}>
            Ganancia promedio/pedido: {stats.canCalculate || stats.completedOrdersToday > 0 ? formatMoney(stats.averageProfitPerOrder) : '—'}
          </span>
        </div>
        <div className="h-3 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${stats.progressPct}%` }}
          />
        </div>
        <p className="text-xs text-light-200/65">
          {stats.canCalculate ? `${Math.round(stats.progressPct)}% del objetivo` : 'El progreso aparecerá con la primera venta rentable de hoy.'}
        </p>
      </div>
    </div>
  )
}
