import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../../firebase'
import { formatMoney } from '../../../utils/cart'
import {
  Truck, DollarSign, ShoppingCart, BarChart2, ChevronDown, ChevronUp,
  PackageSearch, ArrowLeft, Award,
} from 'lucide-react'

const UNIT_SHORT = { kg: 'kg', liter: 'L', ml: 'ml', box: ' caja(s)', units: ' u.', grams: 'g' }
const unitShort = (v) => UNIT_SHORT[v] ?? v

const movDate = (m) => m.purchaseDate?.toDate?.() ?? m.createdAt?.toDate?.() ?? null

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

const HIST_COLS = [
  { key: 'purchaseDate', label: 'Fecha',       align: 'left'  },
  { key: 'materialName', label: 'Material',    align: 'left'  },
  { key: 'quantityChanged', label: 'Cantidad', align: 'right' },
  { key: 'supplier',    label: 'Proveedor',    align: 'left'  },
  { key: 'totalCost',   label: 'Costo Total',  align: 'right' },
]

const COMP_COLS = [
  { key: 'supplier',     label: 'Proveedor',       align: 'left'  },
  { key: 'pricePerUnit', label: 'Precio/Unidad',   align: 'right' },
  { key: 'lastPurchase', label: 'Última Compra',   align: 'right' },
  { key: 'totalSpent',   label: 'Total Gastado',   align: 'right' },
]

const SUB_TABS = [
  { key: 'proveedores', label: 'Proveedores'           },
  { key: 'historial',   label: 'Historial de Compras'  },
  { key: 'comparacion', label: 'Comparación de Precios'},
]

export const SupplierAnalysis = ({ start, end }) => {
  const [movements, setMovements]             = useState([])
  const [materials, setMaterials]             = useState([])
  const [loading, setLoading]                 = useState(true)
  const [subTab, setSubTab]                   = useState('proveedores')
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [histSort, setHistSort]               = useState({ key: 'purchaseDate', dir: 'desc' })
  const [compSort, setCompSort]               = useState({ key: 'pricePerUnit', dir: 'asc'  })
  const [selectedMaterialId, setSelectedMaterialId] = useState('')

  useEffect(() => {
    let alive = true
    let movLoaded = false
    let matLoaded = false
    let unsubMov = null
    let unsubMat = null
    const check = () => { if (movLoaded && matLoaded && alive) setLoading(false) }

    const timer = setTimeout(() => {
      if (!alive) return
      unsubMov = onSnapshot(
        collection(db, 'stockMovements'),
        (snap) => {
          if (!alive) return
          setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
          movLoaded = true; check()
        },
        () => { if (alive) { movLoaded = true; check() } }
      )
      unsubMat = onSnapshot(
        collection(db, 'rawMaterials'),
        (snap) => {
          if (!alive) return
          setMaterials(snap.docs.map((d) => ({ docId: d.id, ...d.data() })))
          matLoaded = true; check()
        },
        () => { if (alive) { matLoaded = true; check() } }
      )
    }, 0)

    return () => {
      alive = false
      clearTimeout(timer)
      if (unsubMov) try { unsubMov() } catch { /* noop */ }
      if (unsubMat) try { unsubMat() } catch { /* noop */ }
    }
  }, [])

  const materialsById = useMemo(
    () => Object.fromEntries(materials.map((m) => [m.docId, m])),
    [materials]
  )

  const purchases = useMemo(() => {
    return movements.filter((m) => {
      if (m.type !== 'purchase') return false
      const d = movDate(m)
      return d && d >= start && d <= end
    })
  }, [movements, start, end])

  const enriched = useMemo(() => {
    return purchases.map((m) => {
      const mat = materialsById[m.materialId]
      return { ...m, materialName: mat?.name ?? 'Material desconocido', materialUnit: mat?.unit ?? '', _date: movDate(m) }
    })
  }, [purchases, materialsById])

  const supplierMap = useMemo(() => {
    const map = {}
    for (const m of enriched) {
      const s = m.supplier?.trim() || 'Sin proveedor'
      if (!map[s]) map[s] = { name: s, totalSpent: 0, purchaseCount: 0, purchases: [] }
      map[s].totalSpent += Number(m.totalCost || 0)
      map[s].purchaseCount += 1
      map[s].purchases.push(m)
    }
    Object.values(map).forEach((s) => {
      s.avgCostPerPurchase = s.purchaseCount > 0 ? s.totalSpent / s.purchaseCount : 0
    })
    return map
  }, [enriched])

  const supplierList = useMemo(
    () => Object.values(supplierMap).sort((a, b) => b.totalSpent - a.totalSpent),
    [supplierMap]
  )

  const materialOptions = useMemo(() => {
    const seen = new Set()
    const opts = []
    for (const m of enriched) {
      if (!seen.has(m.materialId) && m.materialId) {
        seen.add(m.materialId)
        opts.push({ id: m.materialId, name: m.materialName, unit: m.materialUnit })
      }
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name))
  }, [enriched])

  const activeMaterialId = selectedMaterialId || materialOptions[0]?.id || ''
  const activeMaterial   = materialOptions.find((m) => m.id === activeMaterialId)

  const priceComparison = useMemo(() => {
    const map = {}
    for (const m of enriched) {
      if (m.materialId !== activeMaterialId) continue
      const s = m.supplier?.trim() || 'Sin proveedor'
      if (!map[s]) map[s] = { supplier: s, totalCost: 0, totalQty: 0, totalSpent: 0, lastPurchase: null }
      map[s].totalCost  += Number(m.totalCost      || 0)
      map[s].totalQty   += Number(m.quantityChanged || 0)
      map[s].totalSpent += Number(m.totalCost      || 0)
      const d = m._date
      if (d && (!map[s].lastPurchase || d > map[s].lastPurchase)) map[s].lastPurchase = d
    }
    return Object.values(map).map((s) => ({
      ...s,
      pricePerUnit: s.totalQty > 0 ? s.totalCost / s.totalQty : 0,
    }))
  }, [enriched, activeMaterialId])

  const bestSupplier  = useMemo(() => priceComparison.length < 2 ? null : [...priceComparison].sort((a, b) => a.pricePerUnit - b.pricePerUnit)[0],  [priceComparison])
  const worstSupplier = useMemo(() => priceComparison.length < 2 ? null : [...priceComparison].sort((a, b) => b.pricePerUnit - a.pricePerUnit)[0], [priceComparison])

  const toggleHistSort = (key) => setHistSort((p) => p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  const toggleCompSort = (key) => setCompSort((p) => p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })

  const sortedHistory = useMemo(() => {
    const dir = histSort.dir === 'asc' ? 1 : -1
    return [...enriched].sort((a, b) => {
      if (histSort.key === 'purchaseDate')    return ((a._date?.getTime() ?? 0) - (b._date?.getTime() ?? 0)) * dir
      if (histSort.key === 'materialName')    return a.materialName.localeCompare(b.materialName) * dir
      if (histSort.key === 'supplier')        return (a.supplier || '').localeCompare(b.supplier || '') * dir
      return (Number(a[histSort.key] || 0)  - Number(b[histSort.key] || 0)) * dir
    })
  }, [enriched, histSort])

  const sortedComparison = useMemo(() => {
    const dir = compSort.dir === 'asc' ? 1 : -1
    return [...priceComparison].sort((a, b) => {
      if (compSort.key === 'supplier')     return a.supplier.localeCompare(b.supplier) * dir
      if (compSort.key === 'lastPurchase') return ((a.lastPurchase?.getTime() ?? 0) - (b.lastPurchase?.getTime() ?? 0)) * dir
      return (a[compSort.key] - b[compSort.key]) * dir
    })
  }, [priceComparison, compSort])

  const switchTab = (key) => { setSubTab(key); setSelectedSupplier(null) }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-main-900 border border-white/10 rounded-3xl p-5 h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  if (enriched.length === 0) {
    return (
      <div className="bg-main-900 border border-white/10 rounded-3xl py-16 flex flex-col items-center gap-3 text-light-200/55">
        <PackageSearch size={36} />
        <p className="text-sm italic text-center px-4">
          No hay compras registradas en este período.<br />
          Registra compras de stock para ver el análisis de proveedores.
        </p>
      </div>
    )
  }

  const selData = selectedSupplier ? supplierMap[selectedSupplier] : null

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-main-900 border border-white/10 flex-wrap w-fit">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subTab === tab.key ? 'bg-main-500 text-snow' : 'text-light-200/70 hover:text-light-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Proveedores list ── */}
      {subTab === 'proveedores' && !selectedSupplier && (
        <div className="space-y-3">
          {supplierList.map((s) => (
            <button
              key={s.name}
              onClick={() => setSelectedSupplier(s.name)}
              className="w-full bg-main-900 border border-white/10 rounded-3xl p-5 flex items-center justify-between hover:bg-white/3 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-10 w-10 rounded-2xl bg-main-500/10 text-main-500 flex items-center justify-center shrink-0">
                  <Truck size={18} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-bold text-light-100 truncate">{s.name}</p>
                  <p className="text-xs text-light-200/65">{s.purchaseCount} compra{s.purchaseCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-light-100 tabular-nums">{formatMoney(s.totalSpent)}</span>
                <ChevronDown size={16} className="text-light-200/55 -rotate-90 group-hover:text-light-200/60 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Tab 1: Selected supplier detail ── */}
      {subTab === 'proveedores' && selectedSupplier && selData && (
        <div className="space-y-5">
          <button
            onClick={() => setSelectedSupplier(null)}
            className="flex items-center gap-2 text-sm text-light-200/70 hover:text-light-100 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Todos los proveedores
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={DollarSign} label="Total Gastado"     value={formatMoney(selData.totalSpent)}          subtext={`Con ${selData.name}`}       colorCls="bg-emerald-500/10 text-emerald-400" />
            <StatCard icon={ShoppingCart} label="N.º de Compras"  value={selData.purchaseCount.toLocaleString('es-MX')} subtext="En este período"           colorCls="bg-amber-500/10 text-amber-400"   />
            <StatCard icon={BarChart2} label="Promedio por Compra" value={formatMoney(selData.avgCostPerPurchase)}  subtext="Costo promedio por compra"   colorCls="bg-blue-500/10 text-blue-400"     />
          </div>

          <div className="bg-main-900 border border-white/10 rounded-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-light-100">Compras de {selData.name}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-2.5 text-xs font-medium text-light-200/65 uppercase tracking-wider text-left">Fecha</th>
                    <th className="px-5 py-2.5 text-xs font-medium text-light-200/65 uppercase tracking-wider text-left">Material</th>
                    <th className="px-5 py-2.5 text-xs font-medium text-light-200/65 uppercase tracking-wider text-right">Cantidad</th>
                    <th className="px-5 py-2.5 text-xs font-medium text-light-200/65 uppercase tracking-wider text-right">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {[...selData.purchases]
                    .sort((a, b) => (b._date?.getTime() ?? 0) - (a._date?.getTime() ?? 0))
                    .map((m) => (
                      <tr key={m.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-5 py-3 text-light-200/60 text-xs">
                          {m._date ? m._date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                        </td>
                        <td className="px-5 py-3 text-light-100 font-medium truncate max-w-[8rem]">{m.materialName}</td>
                        <td className="px-5 py-3 text-right text-light-200/70 tabular-nums">
                          {Number(m.quantityChanged || 0).toLocaleString('es-MX')}{unitShort(m.materialUnit)}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-light-100 tabular-nums">
                          {formatMoney(Number(m.totalCost || 0))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Historial de Compras ── */}
      {subTab === 'historial' && (
        <div className="bg-main-900 border border-white/10 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-white/10">
                  {HIST_COLS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleHistSort(col.key)}
                      className={`px-5 py-3 text-xs font-medium text-light-200/65 uppercase tracking-wider cursor-pointer select-none hover:text-light-200/70 transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                        {col.label}
                        {histSort.key === col.key && (histSort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sortedHistory.map((m) => (
                  <tr key={m.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3 text-light-200/60 text-xs">
                      {m._date ? m._date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td className="px-5 py-3 text-light-100 font-medium truncate max-w-[8rem]">{m.materialName}</td>
                    <td className="px-5 py-3 text-right text-light-200/70 tabular-nums">
                      {Number(m.quantityChanged || 0).toLocaleString('es-MX')}{unitShort(m.materialUnit)}
                    </td>
                    <td className="px-5 py-3 text-light-200/60 truncate max-w-[8rem]">{m.supplier || '—'}</td>
                    <td className="px-5 py-3 text-right font-bold text-light-100 tabular-nums">
                      {formatMoney(Number(m.totalCost || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Comparación de Precios ── */}
      {subTab === 'comparacion' && (
        <div className="space-y-4">
          {materialOptions.length === 0 ? (
            <div className="bg-main-900 border border-white/10 rounded-3xl py-12 flex flex-col items-center gap-2 text-light-200/55">
              <PackageSearch size={32} />
              <p className="text-sm italic">No hay materiales con compras en este período.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs font-medium text-light-200/70 shrink-0">Material:</label>
                <div className="relative">
                  <select
                    value={activeMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    className="appearance-none bg-main-900 border border-white/10 rounded-xl px-4 py-2 pr-8 text-sm text-light-100 outline-none focus:border-main-500/50 cursor-pointer transition-colors"
                  >
                    {materialOptions.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-light-200/65 pointer-events-none" />
                </div>
              </div>

              {priceComparison.length < 2 ? (
                <div className="bg-main-900 border border-white/10 rounded-2xl px-5 py-4 text-sm text-light-200/65 italic">
                  Solo un proveedor para este material. Registra compras de otros proveedores para comparar.
                </div>
              ) : (
                <>
                  {bestSupplier && worstSupplier && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-start gap-2">
                      <Award size={16} className="shrink-0 mt-0.5" />
                      <span>
                        Usa <strong>{bestSupplier.supplier}</strong> — {formatMoney(worstSupplier.pricePerUnit - bestSupplier.pricePerUnit)}/{activeMaterial?.unit ?? 'u.'} más barato que {worstSupplier.supplier}.
                      </span>
                    </div>
                  )}

                  <div className="bg-main-900 border border-white/10 rounded-3xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[480px]">
                        <thead>
                          <tr className="border-b border-white/10">
                            {COMP_COLS.map((col) => (
                              <th
                                key={col.key}
                                onClick={() => toggleCompSort(col.key)}
                                className={`px-5 py-3 text-xs font-medium text-light-200/65 uppercase tracking-wider cursor-pointer select-none hover:text-light-200/70 transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                              >
                                <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                                  {col.label}
                                  {compSort.key === col.key && (compSort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {sortedComparison.map((s) => {
                            const isBest  = bestSupplier?.supplier  === s.supplier
                            const isWorst = worstSupplier?.supplier === s.supplier
                            return (
                              <tr
                                key={s.supplier}
                                className={`transition-colors ${isBest ? 'bg-emerald-500/5' : isWorst ? 'bg-rose-500/5' : 'hover:bg-white/3'}`}
                              >
                                <td className="px-5 py-3 font-medium text-light-100">
                                  <span className="flex items-center gap-2 flex-wrap">
                                    {s.supplier}
                                    {isBest  && <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">Mejor precio</span>}
                                    {isWorst && <span className="text-[10px] font-bold bg-rose-500/20    text-rose-400    px-1.5 py-0.5 rounded-full">Más caro</span>}
                                  </span>
                                </td>
                                <td className={`px-5 py-3 text-right font-bold tabular-nums ${isBest ? 'text-emerald-400' : isWorst ? 'text-rose-400' : 'text-light-100'}`}>
                                  {formatMoney(s.pricePerUnit)}/{activeMaterial?.unit ?? 'u.'}
                                </td>
                                <td className="px-5 py-3 text-right text-light-200/60 text-xs">
                                  {s.lastPurchase ? s.lastPurchase.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'}
                                </td>
                                <td className="px-5 py-3 text-right text-light-200/70 tabular-nums">{formatMoney(s.totalSpent)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
