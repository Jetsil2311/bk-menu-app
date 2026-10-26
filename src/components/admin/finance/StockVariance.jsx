import { useEffect, useMemo, useState } from 'react'
import { DRINK_BUILDER_ITEM_ID } from '../../../utils/drinkBuilder'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../../firebase'
import { formatMoney } from '../../../utils/cart'
import { estimateItemCost, resolveProductDocId } from '../../../utils/financeCalculations'
import {
  Boxes, Calculator, Receipt, GitCompareArrows, AlertTriangle, ChevronDown, ChevronUp, PackageSearch,
} from 'lucide-react'

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

// Bands intentionally use the signed percent (not magnitude) per spec: negative variance
// (actual came in under what the current recipe implies) is treated as the "good" end.
const varianceColorCls = (pct) => {
  if (pct < 0) return 'text-emerald-400'
  if (pct <= 5) return 'text-amber-300'
  if (pct <= 10) return 'text-amber-400'
  return 'text-rose-400'
}

// Mirrors stockDeduction.js's own per-item ingredient-cost sum exactly, but read-only.
const computeExpectedItemCost = (item, recipesById, docIdByLegacyId, nameToDocId) => {
  const productDocId = resolveProductDocId(item, docIdByLegacyId, nameToDocId)
  const recipe = productDocId ? recipesById[productDocId] : null
  if (!recipe) return null
  return estimateItemCost(item, recipesById, docIdByLegacyId, nameToDocId)
}

const resolveActualItemCost = (item, recipesById, docIdByLegacyId, nameToDocId) => {
  if (typeof item.totalCost === 'number') return item.totalCost
  return estimateItemCost(item, recipesById, docIdByLegacyId, nameToDocId)
}

const COLUMNS = [
  { key: 'name', label: 'Producto', align: 'left' },
  { key: 'expected', label: 'Según receta', align: 'right' },
  { key: 'actual', label: 'Registrado', align: 'right' },
  { key: 'diff', label: 'Diferencia', align: 'right' },
  { key: 'diffPercent', label: '%', align: 'right' },
]

export const StockVariance = ({ orders, docIdByLegacyId = {}, nameToDocId = {} }) => {
  const [rawMaterials, setRawMaterials] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableOpen, setTableOpen] = useState(false)
  const [sort, setSort] = useState({ key: 'diff', dir: 'desc' })

  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsubMaterials = null
    let unsubRecipes = null
    let materialsLoaded = false
    let recipesLoaded = false
    const checkLoaded = () => { if (materialsLoaded && recipesLoaded && alive) setLoading(false) }

    const timer = setTimeout(() => {
      if (cancelled) return
      unsubMaterials = onSnapshot(collection(db, 'rawMaterials'), (snap) => {
        if (!alive) return
        setRawMaterials(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        materialsLoaded = true
        checkLoaded()
      }, () => { if (alive) { materialsLoaded = true; checkLoaded() } })
      unsubRecipes = onSnapshot(collection(db, 'recipes'), (snap) => {
        if (!alive) return
        setRecipes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        recipesLoaded = true
        checkLoaded()
      }, () => { if (alive) { recipesLoaded = true; checkLoaded() } })
    }, 0)

    return () => {
      cancelled = true
      alive = false
      clearTimeout(timer)
      if (unsubMaterials) try { unsubMaterials() } catch { /* noop */ }
      if (unsubRecipes) try { unsubRecipes() } catch { /* noop */ }
    }
  }, [])

  const inventoryValue = useMemo(
    () => rawMaterials.reduce((sum, m) => sum + Number(m.currentStock || 0) * Number(m.costPerUnit || 0), 0),
    [rawMaterials]
  )

  const recipesById = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes])

  const variance = useMemo(() => {
    const byProduct = {}
    let expectedCogs = 0
    let actualCogs = 0
    let excludedItems = 0
    let matchedItems = 0

    for (const order of orders) {
      for (const item of order.items || []) {
        const actual = resolveActualItemCost(item, recipesById, docIdByLegacyId, nameToDocId)
        const expected = computeExpectedItemCost(item, recipesById, docIdByLegacyId, nameToDocId)
        // Only compare items we can price on both sides — an item with no recorded
        // actual cost (no recipe existed at sale time) or no current recipe to derive
        // an expected cost from would otherwise show a phantom variance that's really
        // just missing data, not waste or a portion error.
        if (actual == null || expected == null) { excludedItems += 1; continue }
        matchedItems += 1
        expectedCogs += expected
        actualCogs += actual

        const key = item.productDocId || item.id || item.name
        if (!byProduct[key]) byProduct[key] = { key, name: key === DRINK_BUILDER_ITEM_ID ? 'Arma tu bebida' : (item.name || 'Sin nombre'), expected: 0, actual: 0 }
        byProduct[key].expected += expected
        byProduct[key].actual += actual
      }
    }

    const diff = actualCogs - expectedCogs
    const diffPercent = expectedCogs > 0 ? (diff / expectedCogs) * 100 : 0

    const products = Object.values(byProduct).map((p) => {
      const pDiff = p.actual - p.expected
      const pDiffPercent = p.expected > 0 ? (pDiff / p.expected) * 100 : 0
      return { ...p, diff: pDiff, diffPercent: pDiffPercent }
    })

    return { expectedCogs, actualCogs, diff, diffPercent, products, excludedItems, matchedItems }
  }, [orders, recipesById, docIdByLegacyId, nameToDocId])

  const sortedProducts = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...variance.products].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir
      return (a[sort.key] - b[sort.key]) * dir
    })
  }, [variance.products, sort])

  const toggleSort = (key) => {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const hasOrders = orders.length > 0
  const hasComparableData = variance.matchedItems > 0

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-main-900 border border-white/10 rounded-3xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : !hasOrders ? (
        <div className="bg-main-900 border border-white/10 rounded-3xl py-16 flex flex-col items-center gap-3 text-light-200/55">
          <PackageSearch size={36} />
          <p className="text-sm italic">No hay órdenes en este período.</p>
        </div>
      ) : !hasComparableData ? (
        <div className="bg-main-900 border border-white/10 rounded-3xl py-16 flex flex-col items-center gap-3 text-light-200/55 px-4">
          <PackageSearch size={36} />
          <p className="text-sm italic text-center">Algunas recetas no están definidas. No se puede calcular varianza.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <StatCard
              icon={Boxes}
              label="Valor de tu inventario hoy"
              value={formatMoney(inventoryValue)}
              subtext="Valor de todo el stock en mano"
              colorCls="bg-blue-500/10 text-blue-400"
            />
            <StatCard
              icon={Calculator}
              label="Costo según recetas"
              value={formatMoney(variance.expectedCogs)}
              subtext="Basado en recetas actuales"
              colorCls="bg-purple-500/10 text-purple-400"
            />
            <StatCard
              icon={Receipt}
              label="Costo registrado al cobrar"
              value={formatMoney(variance.actualCogs)}
              subtext="Costo real de las órdenes"
              colorCls="bg-amber-500/10 text-amber-400"
            />
            <StatCard
              icon={GitCompareArrows}
              label="Diferencia"
              value={`${variance.diff >= 0 ? '+' : ''}${formatMoney(variance.diff)} (${variance.diffPercent >= 0 ? '+' : ''}${variance.diffPercent.toFixed(1)}%)`}
              subtext="Diferencia esperado vs real"
              colorCls={variance.diff > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}
            />
          </div>

          {Math.abs(variance.diffPercent) > 5 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Varianza alta detectada. Revisa desperdicio o errores en porciones.</span>
            </div>
          )}

          {variance.excludedItems > 0 && (
            <p className="text-xs text-light-200/55 px-1">
              {variance.excludedItems} línea{variance.excludedItems !== 1 ? 's' : ''} de pedido sin costo registrado o sin receta actual — excluida{variance.excludedItems !== 1 ? 's' : ''} de este cálculo.
            </p>
          )}

          <div className="bg-main-900 border border-white/10 rounded-3xl shadow-sm overflow-hidden">
            <button
              onClick={() => setTableOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 sm:px-6 py-4 cursor-pointer hover:bg-white/3 transition-colors"
            >
              <span className="text-sm font-bold text-light-100">Desglose por producto</span>
              {tableOpen ? <ChevronUp size={18} className="text-light-200/65" /> : <ChevronDown size={18} className="text-light-200/65" />}
            </button>

            {tableOpen && (
              <div className="overflow-x-auto px-5 sm:px-6 pb-5 sm:pb-6">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      {COLUMNS.map((col) => (
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
                    {sortedProducts.map((p) => (
                      <tr key={p.key} className="hover:bg-white/3 transition-colors">
                        <td className="py-3 pr-3 text-light-100 font-medium truncate max-w-[10rem]">{p.name}</td>
                        <td className="py-3 text-right text-light-200/70 tabular-nums">{formatMoney(p.expected)}</td>
                        <td className="py-3 text-right text-light-100 font-semibold tabular-nums">{formatMoney(p.actual)}</td>
                        <td className={`py-3 text-right font-semibold tabular-nums ${varianceColorCls(p.diffPercent)}`}>
                          {p.diff >= 0 ? '+' : ''}{formatMoney(p.diff)}
                        </td>
                        <td className={`py-3 text-right font-bold tabular-nums ${varianceColorCls(p.diffPercent)}`}>
                          {p.diffPercent >= 0 ? '+' : ''}{p.diffPercent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
