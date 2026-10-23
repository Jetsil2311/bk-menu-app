import PropTypes from 'prop-types'
import { useId } from 'react'
import { Link } from 'react-router'
import { Package, Plus, Trash2 } from 'lucide-react'
import { formatMoney } from '../../../utils/cart'
import { computeIngredientTotals, formatQuantity, getUnitLabel, getUnitShortLabel } from '../../../utils/recipeCalculations'
import { getUnitsInFamily } from '../../../utils/unitConversion'
import { iconBtnDanger, inputCls } from '../ui'

// Drink portions are small: a material stocked in liters/kg starts in ml/g.
const PORTION_UNIT = { liter: 'ml', kg: 'grams' }

// "How much raw material does this use?" — rows of material + amount + unit
// with the live cost of each. Amounts can be typed in any unit of the
// material's family (ml for a material stocked in liters, g for kg…).
export const InventoryRows = ({ rows, materials, onChange, emptyLabel = 'No descuenta nada del inventario.' }) => {
  const uid = useId()
  const computed = computeIngredientTotals(rows, materials)
  const total = computed.reduce((sum, r) => sum + r.totalCost, 0)
  const sorted = [...materials].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))

  const setRow = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const removeRow = (i) => onChange(rows.filter((_, j) => j !== i))
  const addRow = () => onChange([...rows, { materialId: '', quantity: '', unit: '' }])

  if (materials.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-white/20 px-3.5 py-3 text-sm text-light-200/80">
        <Package size={18} className="mt-0.5 shrink-0 text-light-200/60" />
        <p>
          Aún no tienes materias primas.{' '}
          <Link to="/admin/stock" className="font-bold text-primary underline-offset-2 hover:underline dark:text-main-300">
            Dalas de alta en Inventario
          </Link>{' '}
          para poder descontarlas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-sm text-light-200/65">{emptyLabel}</p>}

      {computed.map((row, i) => {
        const material = row.material
        const units = material ? getUnitsInFamily(material.unit) : []
        const unit = material ? (units.includes(row.unit) ? row.unit : material.unit) : ''
        return (
          <div key={i} className="rounded-xl border border-white/10 bg-main-800/60 p-2.5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-center lg:gap-2">
            <div className="flex items-center gap-2 lg:order-2 lg:contents">
              <label htmlFor={`${uid}-m${i}`} className="sr-only">Materia prima</label>
              <select
                id={`${uid}-m${i}`}
                value={row.materialId}
                onChange={(e) => {
                  const m = materials.find((x) => x.docId === e.target.value)
                  setRow(i, { materialId: e.target.value, unit: PORTION_UNIT[m?.unit] || m?.unit || '' })
                }}
                className={`${inputCls} min-w-0 flex-1`}
              >
                <option value="">Elige materia prima…</option>
                {sorted.map((m) => (
                  <option key={m.docId} value={m.docId}>
                    {m.name} ({getUnitLabel(m.unit)})
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => removeRow(i)} aria-label="Quitar fila" className={`${iconBtnDanger} lg:hidden`}>
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 lg:mt-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <label htmlFor={`${uid}-q${i}`} className="sr-only">Cantidad</label>
              <input
                id={`${uid}-q${i}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={rows[i].quantity}
                onChange={(e) => setRow(i, { quantity: e.target.value })}
                placeholder="Cantidad"
                className={inputCls}
              />
              <label htmlFor={`${uid}-u${i}`} className="sr-only">Unidad</label>
              <select
                id={`${uid}-u${i}`}
                value={unit}
                disabled={!material}
                onChange={(e) => setRow(i, { unit: e.target.value })}
                className={`${inputCls} disabled:opacity-50`}
              >
                {!material && <option value="">Unidad</option>}
                {units.map((u) => <option key={u} value={u}>{getUnitLabel(u)}</option>)}
              </select>
              <span className="min-w-[72px] text-right text-sm font-bold tabular-nums text-light-100">
                {formatMoney(row.totalCost)}
              </span>
              <button type="button" onClick={() => removeRow(i)} aria-label="Quitar fila" className={`${iconBtnDanger} hidden lg:inline-flex`}>
                <Trash2 size={16} />
              </button>
            </div>
            {material && unit !== material.unit && row.quantityInMaterialUnit > 0 && (
              <p className="mt-1.5 text-xs text-light-200/65 lg:col-span-2 lg:mt-0">
                = {formatQuantity(row.quantityInMaterialUnit)}{getUnitShortLabel(material.unit)} del inventario
              </p>
            )}
          </div>
        )
      })}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10 dark:text-main-300"
        >
          <Plus size={16} /> Materia prima
        </button>
        {rows.length > 0 && (
          <span className="text-sm text-light-200/75">
            Costo: <span className="font-bold tabular-nums text-light-100">{formatMoney(total)}</span>
          </span>
        )}
      </div>
    </div>
  )
}

InventoryRows.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.shape({
    materialId: PropTypes.string,
    quantity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    unit: PropTypes.string,
  })).isRequired,
  materials: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  emptyLabel: PropTypes.string,
}
