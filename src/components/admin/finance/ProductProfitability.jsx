import { useMemo, useState } from 'react'
import { formatMoney } from '../../../utils/cart'
import { itemLineTotal } from '../../../utils/financeCalculations'
import { Table2, Search, ChevronUp, ChevronDown, X } from 'lucide-react'

const COLUMNS = [
  { key: 'name', label: 'Producto', align: 'left' },
  { key: 'units', label: 'Unidades', align: 'right' },
  { key: 'revenue', label: 'Ingresos', align: 'right' },
  { key: 'cost', label: 'Costo', align: 'right', hideOnMobile: true },
  { key: 'profit', label: 'Ganancia', align: 'right' },
  { key: 'margin', label: 'Margen %', align: 'right' },
]

const marginColorCls = (margin) => {
  if (margin === null) return 'text-light-200/30'
  if (margin >= 80) return 'text-emerald-400'
  if (margin >= 60) return 'text-amber-400'
  return 'text-rose-400'
}

export const ProductProfitability = ({ orders }) => {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'revenue', dir: 'desc' })

  const productMetrics = useMemo(() => {
    const byProduct = {}
    for (const order of orders) {
      for (const item of order.items || []) {
        const key = item.productDocId || item.id || item.name
        if (!byProduct[key]) byProduct[key] = { key, name: item.name || 'Sin nombre', units: 0, revenue: 0, cost: 0, missingRecipe: false, hasEstimate: false }
        const row = byProduct[key]
        row.units += item.qty || 0
        row.revenue += itemLineTotal(item)
        if (item.totalCost == null) row.missingRecipe = true
        else row.cost += Number(item.totalCost || 0)
        if (item.costEstimated) row.hasEstimate = true
      }
    }
    return Object.values(byProduct).map((row) => {
      const profit = row.revenue - row.cost
      const margin = row.missingRecipe ? null : (row.revenue > 0 ? (profit / row.revenue) * 100 : 0)
      return { ...row, profit, margin }
    })
  }, [orders])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = term ? productMetrics.filter((r) => r.name.toLowerCase().includes(term)) : productMetrics
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir
      const av = a[sort.key] ?? -1
      const bv = b[sort.key] ?? -1
      return (av - bv) * dir
    })
  }, [productMetrics, search, sort])

  const toggleSort = (key) => {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  return (
    <div className="bg-main-900/30 border border-white/5 rounded-3xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Table2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-light-100">Rentabilidad por Producto</h3>
            <p className="text-xs text-light-200/40">Toca una columna para ordenar</p>
          </div>
        </div>
        <div className="relative w-full sm:w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full rounded-xl border border-white/10 bg-main-900/60 pl-8 pr-8 py-2 text-sm text-light-100 outline-none focus:border-main-500/50 transition-colors placeholder:text-light-200/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-light-200/30 hover:text-light-100 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {productMetrics.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2 text-light-200/30">
          <Table2 size={32} />
          <p className="text-sm italic">No hay datos en este período.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2 text-light-200/30">
          <Search size={32} />
          <p className="text-sm italic">No hay productos que coincidan con &quot;{search}&quot;.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr className="border-b border-white/5">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`py-2.5 text-xs font-medium text-light-200/40 uppercase tracking-wider cursor-pointer select-none hover:text-light-200/70 transition-colors ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    } ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                  >
                    <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                      {col.label}
                      {sort.key === col.key && (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((row) => (
                <tr key={row.key} className="hover:bg-white/3 transition-colors">
                  <td className="py-3 pr-3 text-light-100 font-medium truncate max-w-[10rem]">{row.name}</td>
                  <td className="py-3 text-right text-light-200/70 tabular-nums">{row.units.toLocaleString('es-MX')}</td>
                  <td className="py-3 text-right text-light-100 font-semibold tabular-nums">{formatMoney(row.revenue)}</td>
                  <td className="py-3 text-right text-light-200/70 tabular-nums hidden md:table-cell">
                    {row.missingRecipe ? <span className="text-amber-400/70">N/D</span> : (
                      <span className={row.hasEstimate ? 'text-amber-300' : ''}>{formatMoney(row.cost)}</span>
                    )}
                  </td>
                  <td className="py-3 text-right text-light-100 font-semibold tabular-nums">
                    {row.missingRecipe ? <span className="text-amber-400/70">N/D</span> : (
                      <span className={row.hasEstimate ? 'text-amber-300' : ''}>{formatMoney(row.profit)}</span>
                    )}
                  </td>
                  <td className={`py-3 text-right font-bold tabular-nums ${marginColorCls(row.margin)}`}>
                    {row.margin === null ? 'N/D' : `${row.margin.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
