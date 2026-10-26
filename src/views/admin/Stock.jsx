/* eslint-disable react/prop-types */
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, deleteField,
  serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { formatMoney } from '../../utils/cart'
import { convertUnits, getUnitsInFamily } from '../../utils/unitConversion'
import {
  buildOptionGroupsDraft,
  computeGroupBounds,
  computeIngredientTotals,
  formatQuantity,
  getMarginColor,
  getRecipeSummary,
  getUnitLabel,
  getUnitShortLabel,
  RECIPE_SORT_OPTIONS,
  UNIT_OPTIONS,
  validateIngredientRows,
} from '../../utils/recipeCalculations'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { isLowStock } from '../../utils/stockAlerts'
import {
  Package, PackagePlus, Boxes, Search, Plus, Pencil, Trash2, X, Check,
  AlertTriangle, ChevronDown, Loader2, Eye, ChevronsUpDown, BookOpen, Circle, CheckCircle2,
} from 'lucide-react'

const unitLabel = getUnitLabel
const unitShort = getUnitShortLabel
const formatQty = formatQuantity
const marginColor = getMarginColor
const buildGroupsDraft = buildOptionGroupsDraft


const inputCls =
  'w-full rounded-xl border border-white/10 bg-main-900 px-3 py-2.5 text-sm text-light-100 placeholder-light-200/55 outline-none transition focus:border-main-500/50 focus:ring-1 focus:ring-main-500/20'
const labelCls = 'block text-xs font-medium text-light-200/60 mb-1.5'
const hintCls = 'mt-1 text-[11px] leading-snug text-light-200/60'

// Relative time in Spanish, matching the rest of the admin panel's locale.
const formatRelative = (date) => {
  if (!date) return 'Sin movimientos'
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return 'Justo ahora'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Hace ${diffMin} min`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `Hace ${diffHr} h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `Hace ${diffDay} d`
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

const DeleteConfirm = ({ label, onConfirm, onCancel, loading }) => (
  <ConfirmDialog message={label} onConfirm={onConfirm} onCancel={onCancel} isPending={loading} />
)

// ─── Add / Edit Material Modal ────────────────────────────────────────────────
const MaterialModal = ({ material, onClose }) => {
  const isEdit = Boolean(material)
  const [name, setName] = useState(material?.name || '')
  const [costPerUnit, setCostPerUnit] = useState(material?.costPerUnit ?? '')
  const [unit, setUnit] = useState(material?.unit || 'kg')
  const [reorderLevel, setReorderLevel] = useState(material?.reorderLevel ?? '')
  const [supplier, setSupplier] = useState(material?.supplier || '')
  const [initialStock, setInitialStock] = useState('')
  const [notes, setNotes] = useState(material?.notes || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = async () => {
    const trimmedName = name.trim()
    const cost = Number(costPerUnit)
    if (!trimmedName || !Number.isFinite(cost) || cost < 0 || !unit) {
      setError('Nombre, costo válido y unidad son obligatorios.')
      return
    }

    const reorder = reorderLevel === '' ? 0 : Number(reorderLevel)
    setError('')
    setSaving(true)
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'rawMaterials', material.docId), {
          name: trimmedName,
          costPerUnit: cost,
          unit,
          reorderLevel: Number.isFinite(reorder) ? reorder : 0,
          supplier: supplier.trim(),
          notes: notes.trim(),
          lastUpdated: serverTimestamp(),
        })
      } else {
        const initial = initialStock === '' ? 0 : Number(initialStock)
        await addDoc(collection(db, 'rawMaterials'), {
          name: trimmedName,
          costPerUnit: cost,
          unit,
          currentStock: Number.isFinite(initial) ? initial : 0,
          reorderLevel: Number.isFinite(reorder) ? reorder : 0,
          supplier: supplier.trim(),
          notes: notes.trim(),
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        })
      }
      setDone(true)
      setTimeout(onClose, 700)
    } catch {
      setError(isEdit ? 'No se pudo actualizar el material.' : 'No se pudo guardar el material.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-main-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-light-100">
            {isEdit ? 'Editar insumo' : 'Nuevo insumo'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-xl hover:bg-white/5 text-light-200/70 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Café Arábica"
              autoFocus
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Costo por unidad *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/65 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(e.target.value)}
                  placeholder="0.00"
                  className={inputCls + ' pl-7'}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Unidad *</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className={hintCls + ' -mt-1'}>
            Lo que pagas por 1 {unitLabel(unit).toLowerCase()}. Ej.: si 1 litro de leche cuesta $26, pon $26 y unidad Litro.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Avisar cuando queden</label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
              <p className={hintCls}>Te avisamos con sonido y una alerta en el menú al llegar a esta cantidad. 0 = sin aviso.</p>
            </div>
            {!isEdit && (
              <div>
                <label className={labelCls}>Cantidad que tienes hoy</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
                <p className={hintCls}>En {unitShort(unit)}. Después se ajusta sola con ventas y compras.</p>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Proveedor</label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Opcional"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Notas</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className={inputCls + ' resize-none'}
            />
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-light-200/70 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || done}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-main-500 hover:bg-main-400 text-snow flex items-center justify-center gap-2"
          >
            {done ? <><Check size={16} /> Guardado</> : saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Stock Purchase Modal ─────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10)

const AddStockPurchaseModal = ({ materials, onClose, onSuccess }) => {
  const [search, setSearch] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [cost, setCost] = useState('')
  const [costTouched, setCostTouched] = useState(false)
  const [purchaseDate, setPurchaseDate] = useState(todayStr())
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const comboRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { comboOpen ? setComboOpen(false) : onClose() } }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, comboOpen])

  useEffect(() => {
    const handler = (e) => {
      if (comboRef.current && !comboRef.current.contains(e.target)) setComboOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredMaterials = materials.filter((m) =>
    (m.name || '').toLowerCase().includes(search.trim().toLowerCase())
  )

  const selectMaterial = (m) => {
    setSelectedMaterial(m)
    setSearch(`${m.name} (${unitLabel(m.unit)})`)
    setSupplier(m.supplier || '')
    setComboOpen(false)
    setFieldErrors((prev) => ({ ...prev, material: undefined }))
    setCostTouched(false)
    const q = Number(quantity)
    if (Number.isFinite(q) && q > 0) {
      setCost((q * (m.costPerUnit || 0)).toFixed(2))
    }
  }

  const handleQuantityChange = (value) => {
    setQuantity(value)
    setFieldErrors((prev) => ({ ...prev, quantity: undefined }))
    if (!costTouched && selectedMaterial) {
      const q = Number(value)
      setCost(Number.isFinite(q) && q > 0 ? (q * (selectedMaterial.costPerUnit || 0)).toFixed(2) : '')
    }
  }

  const handleCostChange = (value) => {
    setCost(value)
    setCostTouched(true)
    setFieldErrors((prev) => ({ ...prev, cost: undefined }))
  }

  const canSave = Boolean(selectedMaterial) && Number(quantity) > 0 && !saving

  const handleSave = async () => {
    const qty = Number(quantity)
    const totalCost = Number(cost)
    const errs = {}
    if (!selectedMaterial) errs.material = 'Selecciona un material.'
    if (!Number.isFinite(qty) || qty <= 0) errs.quantity = 'La cantidad debe ser mayor a 0.'
    if (!Number.isFinite(totalCost) || totalCost <= 0) errs.cost = 'El costo debe ser mayor a 0.'
    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      return
    }

    setError('')
    setSaving(true)
    try {
      const previousStock = selectedMaterial.currentStock ?? 0
      const newStock = previousStock + qty

      const batch = writeBatch(db)
      batch.update(doc(db, 'rawMaterials', selectedMaterial.docId), {
        currentStock: newStock,
        lastUpdated: serverTimestamp(),
      })
      const movementRef = doc(collection(db, 'stockMovements'))
      batch.set(movementRef, {
        type: 'purchase',
        materialId: selectedMaterial.docId,
        quantityChanged: qty,
        previousStock,
        newStock,
        costPerUnit: selectedMaterial.costPerUnit ?? 0,
        totalCost,
        purchaseDate: purchaseDate ? new Date(`${purchaseDate}T12:00:00`) : new Date(),
        invoiceNumber: invoiceNumber.trim(),
        supplier: supplier.trim(),
        notes: notes.trim(),
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || '',
      })
      await batch.commit()

      onSuccess(`Stock agregado: +${qty}${unitShort(selectedMaterial.unit)} ${selectedMaterial.name}`)
      onClose()
    } catch {
      setError('No se pudo agregar el stock. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-main-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-light-100">Registrar compra</h3>
            <p className="text-xs text-light-200/65 mt-0.5">Suma lo que compraste al inventario y actualiza el costo del insumo.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-xl hover:bg-white/5 text-light-200/70 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 mb-5">
          <div ref={comboRef} className="relative">
            <label htmlFor="purchase-material" className={labelCls}>Insumo *</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/55" />
              <input
                id="purchase-material"
                type="text"
                role="combobox"
                aria-expanded={comboOpen}
                aria-controls="purchase-material-list"
                autoComplete="off"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSelectedMaterial(null)
                  setComboOpen(true)
                }}
                onFocus={() => setComboOpen(true)}
                placeholder="Buscar insumo…"
                className={inputCls + ' pl-8 pr-8'}
              />
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-light-200/55 pointer-events-none" />
            </div>

            {comboOpen && (
              <div
                id="purchase-material-list"
                role="listbox"
                className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-main-800 shadow-2xl"
              >
                {filteredMaterials.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-light-200/65 italic">Sin materiales encontrados.</p>
                ) : (
                  filteredMaterials.map((m) => (
                    <button
                      key={m.docId}
                      type="button"
                      role="option"
                      aria-selected={selectedMaterial?.docId === m.docId}
                      onClick={() => selectMaterial(m)}
                      className="w-full text-left px-3 py-2.5 text-sm text-light-100 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      {m.name} <span className="text-light-200/65">({unitLabel(m.unit)})</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {fieldErrors.material && <p className="mt-1 text-xs text-red-400">{fieldErrors.material}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="purchase-qty" className={labelCls}>Cantidad *</label>
              <input
                id="purchase-qty"
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="Ej: 12"
                className={inputCls}
              />
              {fieldErrors.quantity && <p className="mt-1 text-xs text-red-400">{fieldErrors.quantity}</p>}
            </div>
            <div>
              <label htmlFor="purchase-cost" className={labelCls}>Costo total *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/65 text-sm">$</span>
                <input
                  id="purchase-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => handleCostChange(e.target.value)}
                  placeholder="0.00"
                  className={inputCls + ' pl-7 bg-main-800/80'}
                />
              </div>
              {fieldErrors.cost && <p className="mt-1 text-xs text-red-400">{fieldErrors.cost}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="purchase-date" className={labelCls}>Fecha de compra</label>
              <input
                id="purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="purchase-invoice" className={labelCls}>N.º de factura</label>
              <input
                id="purchase-invoice"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="FAC-2024-001"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label htmlFor="purchase-supplier" className={labelCls}>Proveedor</label>
            <input
              id="purchase-supplier"
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Opcional"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="purchase-notes" className={labelCls}>Notas</label>
            <textarea
              id="purchase-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas de entrega, condición, calidad, etc."
              className={inputCls + ' resize-none'}
            />
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-light-200/70 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-main-500 hover:bg-main-400 text-snow flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Recipe Ingredient Row (with its own material combobox) ──────────────────
const IngredientRow = ({ index, ingredient, materials, onChange, onRemove }) => {
  const material = materials.find((m) => m.docId === ingredient.materialId)
  const [search, setSearch] = useState(material ? `${material.name} (${unitLabel(material.unit)})` : '')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = materials.filter((m) => (m.name || '').toLowerCase().includes(search.trim().toLowerCase()))

  const selectMaterial = (m) => {
    // Changing material resets the recipe-line unit to the new material's own
    // unit — any previous unit choice belonged to the old material's family.
    onChange(index, { materialId: m.docId, unit: m.unit })
    setSearch(`${m.name} (${unitLabel(m.unit)})`)
    setOpen(false)
  }

  const familyUnits = material ? getUnitsInFamily(material.unit) : []
  // Stale/cross-family stored unit (e.g. material's own unit changed after this
  // recipe was saved) falls back to the material's current unit instead of
  // rendering an invalid <select> value.
  const selectedUnit = material
    ? (familyUnits.includes(ingredient.unit) ? ingredient.unit : material.unit)
    : ''
  const unitDiffers = Boolean(material) && selectedUnit !== material.unit

  const unitCost = material?.costPerUnit ?? 0
  const qty = Number(ingredient.quantity)
  const quantityInMaterialUnit = material && Number.isFinite(qty) && qty > 0
    ? convertUnits(qty, selectedUnit, material.unit)
    : 0
  const totalCost = quantityInMaterialUnit > 0 ? quantityInMaterialUnit * unitCost : 0

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <div ref={ref} className="relative flex-1 min-w-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/55" />
            <input
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-label={`Material del ingrediente ${index + 1}`}
              autoComplete="off"
              value={search}
              onChange={(e) => { setSearch(e.target.value); onChange(index, { materialId: null }); setOpen(true) }}
              onFocus={() => setOpen(true)}
              placeholder="Buscar material…"
              className={inputCls + ' pl-8 pr-8'}
            />
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-light-200/55 pointer-events-none" />
          </div>
          {open && (
            <div role="listbox" className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-main-800 shadow-2xl">
              {filtered.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-light-200/65 italic">Sin materiales encontrados.</p>
              ) : (
                filtered.map((m) => (
                  <button
                    key={m.docId}
                    type="button"
                    role="option"
                    onClick={() => selectMaterial(m)}
                    className="w-full text-left px-3 py-2.5 text-sm text-light-100 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    {m.name} <span className="text-light-200/65">({unitLabel(m.unit)})</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => onRemove(index)}
          aria-label={`Quitar ingrediente ${index + 1}`}
          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-light-200/70 hover:text-red-400 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className={labelCls}>Cantidad *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={ingredient.quantity}
            onChange={(e) => onChange(index, { quantity: e.target.value })}
            placeholder="0.00"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Unidad</label>
          {material ? (
            <select
              value={selectedUnit}
              onChange={(e) => onChange(index, { unit: e.target.value })}
              aria-label={`Unidad del ingrediente ${index + 1}`}
              className={`${inputCls} ${unitDiffers ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : ''}`}
            >
              {familyUnits.map((u) => (
                <option key={u} value={u}>{unitShort(u) || unitLabel(u)}</option>
              ))}
            </select>
          ) : (
            <div className={inputCls + ' bg-main-800/40 text-light-200/70 flex items-center'}>—</div>
          )}
        </div>
        <div>
          <label className={labelCls}>Costo unitario</label>
          <div className={inputCls + ' bg-main-800/40 text-light-200/70 flex items-center tabular-nums'}>
            {material ? `${formatMoney(unitCost)}/${unitShort(material.unit) || unitLabel(material.unit)}` : '—'}
          </div>
        </div>
        <div>
          <label className={labelCls}>Costo total</label>
          <div className={inputCls + ' bg-main-500/10 border-main-500/30 text-light-100 font-semibold flex items-center tabular-nums'}>
            {formatMoney(totalCost)}
          </div>
        </div>
      </div>

      {unitDiffers && quantityInMaterialUnit > 0 && (
        <p className="text-[11px] text-amber-300/70">
          ≈ {formatQty(quantityInMaterialUnit)} {unitLabel(material.unit)} (unidad del material)
        </p>
      )}
    </div>
  )
}

// ─── Variation Tabs (shared by editor + read-only viewer) ─────────────────────
const VariationTabs = ({ options, activeKey, completedKeys, onSelect }) => {
  const listRef = useRef(null)
  if (options.length <= 1) return null

  const handleKeyDown = (e, idx) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const nextIdx = (idx + dir + options.length) % options.length
    onSelect(options[nextIdx].id)
    requestAnimationFrame(() => {
      listRef.current?.querySelectorAll('[role="tab"]')[nextIdx]?.focus()
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Variaciones"
      ref={listRef}
      className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1 scrollbar-hide"
    >
      {options.map((opt, idx) => {
        const isActive = opt.id === activeKey
        const isDone = completedKeys.has(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              isActive
                ? 'bg-main-500 text-snow'
                : 'bg-white/5 text-light-200/60 hover:bg-white/10 hover:text-light-100'
            }`}
          >
            {isDone ? (
              <CheckCircle2 size={13} className={isActive ? 'text-snow' : 'text-emerald-400'} />
            ) : (
              <Circle size={13} className="opacity-50" />
            )}
            {opt.name}
          </button>
        )
      })}
    </div>
  )
}

// ─── Option Group Ingredients Editor ──────────────────────────────────────────
// One of these renders per option group on the product. Every option in the
// group gets its own independent ingredient list (extra ingredients on top of
// the fixed base) — fully controlled by the parent so tab-switching is a plain
// state change, no flush/validation needed until save.
const OptionGroupEditor = ({ group, groupDraft, materials, onSelectOption, onUpdateIngredient, onAddIngredient, onRemoveIngredient }) => {
  const options = useMemo(() => group.options || [], [group.options])
  const activeOptionId = groupDraft.activeOptionId ?? options[0]?.id
  const activeRows = groupDraft.options[activeOptionId] || []
  const computedRows = computeIngredientTotals(activeRows, materials)
  const activeCost = computedRows.reduce((sum, r) => sum + r.totalCost, 0)
  const activeName = options.find((o) => o.id === activeOptionId)?.name

  const completedKeys = useMemo(() => {
    const set = new Set()
    options.forEach((o) => {
      const rows = groupDraft.options[o.id] || []
      if (rows.some((r) => r.materialId && Number(r.quantity) > 0)) set.add(o.id)
    })
    return set
  }, [groupDraft, options])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-light-100">{group.name || 'Grupo sin nombre'}</h4>
        <span className="text-xs text-light-200/55">
          {group.type === 'multi' ? 'Selección múltiple' : 'Selección única'}{group.required ? ' · requerido' : ''}
        </span>
      </div>

      <VariationTabs options={options} activeKey={activeOptionId} completedKeys={completedKeys} onSelect={(id) => onSelectOption(group.id, id)} />

      <p className="text-xs text-light-200/65">
        Ingredientes extra para: <span className="text-light-200/70 font-medium">{activeName}</span>
      </p>

      <div className="space-y-2">
        {computedRows.length === 0 ? (
          <p className="text-xs text-light-200/55 italic py-2">Sin ingredientes extra para esta opción.</p>
        ) : (
          computedRows.map((row, idx) => (
            <IngredientRow
              key={idx}
              index={idx}
              ingredient={row}
              materials={materials}
              onChange={(i, patch) => onUpdateIngredient(group.id, activeOptionId, i, patch)}
              onRemove={(i) => onRemoveIngredient(group.id, activeOptionId, i)}
            />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => onAddIngredient(group.id, activeOptionId)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/15 text-light-200/70 hover:text-light-100 hover:border-white/30 hover:bg-white/5 text-xs font-medium transition-colors cursor-pointer"
      >
        <Plus size={13} />
        Agregar ingrediente extra
      </button>

      <p className="text-xs text-light-200/65 text-right">
        Costo extra con {activeName}: <span className="font-semibold text-light-100">{formatMoney(activeCost)}</span>
      </p>
    </div>
  )
}

// ─── Recipe Editor Modal ───────────────────────────────────────────────────────
const RecipeEditorModal = ({ product, existingRecipe, materials, onClose, onSuccess }) => {
  const optionGroups = useMemo(
    () => (Array.isArray(product.optionGroups) ? product.optionGroups : []),
    [product.optionGroups]
  )

  const [fixedDraft, setFixedDraft] = useState(() =>
    (existingRecipe?.fixedIngredients || []).map((i) => ({ materialId: i.materialId, quantity: String(i.quantity), unit: i.unit }))
  )
  const [groupsDraft, setGroupsDraft] = useState(() => buildGroupsDraft(optionGroups, existingRecipe))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const fixedComputed = useMemo(() => computeIngredientTotals(fixedDraft, materials), [fixedDraft, materials])
  const fixedCogs = fixedComputed.reduce((sum, r) => sum + r.totalCost, 0)

  const groupsComputed = useMemo(() => optionGroups.map((g) => {
    const state = groupsDraft[g.id] ?? { activeOptionId: g.options?.[0]?.id ?? null, options: {} }
    const costs = (g.options || []).map((o) => {
      const rows = computeIngredientTotals(state.options[o.id] || [], materials)
      return rows.reduce((sum, r) => sum + r.totalCost, 0)
    })
    return { group: g, bounds: computeGroupBounds(g, costs) }
  }), [groupsDraft, materials, optionGroups])

  const totalMinCogs = fixedCogs + groupsComputed.reduce((sum, g) => sum + g.bounds.min, 0)
  const totalMaxCogs = fixedCogs + groupsComputed.reduce((sum, g) => sum + g.bounds.max, 0)
  const sellingPrice = product.price || 0
  const maxMarginPercent = sellingPrice > 0 ? ((sellingPrice - totalMinCogs) / sellingPrice) * 100 : 0
  const minMarginPercent = sellingPrice > 0 ? ((sellingPrice - totalMaxCogs) / sellingPrice) * 100 : 0
  const hasRange = optionGroups.length > 0 && totalMinCogs !== totalMaxCogs

  const handleFixedAdd = () => setFixedDraft((prev) => [...prev, { materialId: null, quantity: '' }])
  const handleFixedUpdate = (idx, patch) => setFixedDraft((prev) => prev.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing)))
  const handleFixedRemove = (idx) => setFixedDraft((prev) => prev.filter((_, i) => i !== idx))

  const handleSelectOption = (groupId, optionId) =>
    setGroupsDraft((prev) => ({ ...prev, [groupId]: { ...prev[groupId], activeOptionId: optionId } }))

  const handleGroupAdd = (groupId, optionId) =>
    setGroupsDraft((prev) => {
      const g = prev[groupId]
      const rows = g.options[optionId] || []
      return { ...prev, [groupId]: { ...g, options: { ...g.options, [optionId]: [...rows, { materialId: null, quantity: '' }] } } }
    })

  const handleGroupUpdate = (groupId, optionId, idx, patch) =>
    setGroupsDraft((prev) => {
      const g = prev[groupId]
      const rows = (g.options[optionId] || []).map((r, i) => (i === idx ? { ...r, ...patch } : r))
      return { ...prev, [groupId]: { ...g, options: { ...g.options, [optionId]: rows } } }
    })

  const handleGroupRemove = (groupId, optionId, idx) =>
    setGroupsDraft((prev) => {
      const g = prev[groupId]
      const rows = (g.options[optionId] || []).filter((_, i) => i !== idx)
      return { ...prev, [groupId]: { ...g, options: { ...g.options, [optionId]: rows } } }
    })

  const cleanedFixedDraft = fixedDraft.filter((r) => r.materialId || r.quantity)
  const isValid = cleanedFixedDraft.length > 0 && !validateIngredientRows(cleanedFixedDraft)

  const handleSave = async () => {
    const cleanedFixed = fixedDraft.filter((r) => r.materialId || r.quantity)
    if (cleanedFixed.length === 0) {
      setError('Agrega al menos un ingrediente fijo — aplica a todas las variaciones.')
      return
    }
    if (validateIngredientRows(cleanedFixed)) {
      setError('Completa material y cantidad válidos en los ingredientes fijos.')
      return
    }
    for (const g of optionGroups) {
      const state = groupsDraft[g.id] ?? { options: {} }
      for (const o of (g.options || [])) {
        const cleaned = (state.options[o.id] || []).filter((r) => r.materialId || r.quantity)
        if (validateIngredientRows(cleaned)) {
          setError(`Revisa los ingredientes extra de "${g.name}" → "${o.name}".`)
          setGroupsDraft((prev) => ({ ...prev, [g.id]: { ...prev[g.id], activeOptionId: o.id } }))
          return
        }
      }
    }

    setError('')
    setSaving(true)
    try {
      const finalFixed = computeIngredientTotals(cleanedFixed, materials).map((r) => ({
        materialId: r.materialId,
        materialName: r.material?.name || '',
        quantity: Number(r.quantity),
        unit: r.unit || '',
        materialUnit: r.materialUnit || '',
        quantityInMaterialUnit: Number((r.quantityInMaterialUnit || 0).toFixed(6)),
        unitCost: r.unitCost,
        totalCost: Number(r.totalCost.toFixed(2)),
      }))
      const finalFixedCogs = finalFixed.reduce((sum, r) => sum + r.totalCost, 0)

      const optionIngredients = {}
      optionGroups.forEach((g) => {
        const state = groupsDraft[g.id] ?? { options: {} }
        const optionsPayload = {}
        ;(g.options || []).forEach((o) => {
          const cleaned = (state.options[o.id] || []).filter((r) => r.materialId || r.quantity)
          const rows = computeIngredientTotals(cleaned, materials)
          const ingredients = rows.map((r) => ({
            materialId: r.materialId,
            materialName: r.material?.name || '',
            quantity: Number(r.quantity),
            unit: r.unit || '',
            materialUnit: r.materialUnit || '',
            quantityInMaterialUnit: Number((r.quantityInMaterialUnit || 0).toFixed(6)),
            unitCost: r.unitCost,
            totalCost: Number(r.totalCost.toFixed(2)),
          }))
          optionsPayload[o.id] = {
            optionName: o.name,
            ingredients,
            totalCost: Number(ingredients.reduce((sum, i) => sum + i.totalCost, 0).toFixed(2)),
          }
        })
        optionIngredients[g.id] = { groupName: g.name || '', options: optionsPayload }
      })

      let minAdd = 0
      let maxAdd = 0
      optionGroups.forEach((g) => {
        const costs = (g.options || []).map((o) => optionIngredients[g.id].options[o.id].totalCost)
        const bounds = computeGroupBounds(g, costs)
        minAdd += bounds.min
        maxAdd += bounds.max
      })
      const minCogs = Number((finalFixedCogs + minAdd).toFixed(2))
      const maxCogs = Number((finalFixedCogs + maxAdd).toFixed(2))
      const maxMargin = sellingPrice > 0 ? Number((((sellingPrice - minCogs) / sellingPrice) * 100).toFixed(1)) : 0
      const minMargin = sellingPrice > 0 ? Number((((sellingPrice - maxCogs) / sellingPrice) * 100).toFixed(1)) : 0

      const payload = {
        productId: product.docId,
        productName: product.name,
        sellingPrice,
        fixedIngredients: finalFixed,
        fixedCogs: Number(finalFixedCogs.toFixed(2)),
        optionIngredients,
        minCogs,
        maxCogs,
        minMarginPercent: minMargin,
        maxMarginPercent: maxMargin,
        completionStatus: 'complete',
        lastUpdated: serverTimestamp(),
        updatedBy: auth.currentUser?.email || '',
        // Clear any leftover shape from earlier recipe-model iterations.
        variations: deleteField(),
        variationGroupId: deleteField(),
        averageCogs: deleteField(),
        averageProfitPerUnit: deleteField(),
        averageMarginPercent: deleteField(),
        ingredients: deleteField(),
        totalCogs: deleteField(),
        profitPerUnit: deleteField(),
        profitMarginPercent: deleteField(),
      }
      if (!existingRecipe) payload.createdAt = serverTimestamp()

      await setDoc(doc(db, 'recipes', product.docId), payload, { merge: true })
      onSuccess(`Receta guardada: ${product.name}`)
      onClose()
    } catch {
      setError('No se pudo guardar la receta. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-main-900 border border-white/10 rounded-3xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-light-100">{product.name}</h3>
            <p className="text-xs text-light-200/65 mt-0.5">Precio de venta: {formatMoney(sellingPrice)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-xl hover:bg-white/5 text-light-200/70 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-5">
          <h4 className="text-sm font-semibold text-light-100 mb-1">Ingredientes Fijos</h4>
          <p className="text-xs text-light-200/65 mb-3">Aplican a todas las variaciones de este producto.</p>
          <div className="space-y-2.5 mb-3">
            {fixedComputed.length === 0 ? (
              <p className="text-sm text-light-200/55 italic text-center py-4">Agrega el primer ingrediente fijo.</p>
            ) : (
              fixedComputed.map((row, idx) => (
                <IngredientRow key={idx} index={idx} ingredient={row} materials={materials} onChange={handleFixedUpdate} onRemove={handleFixedRemove} />
              ))
            )}
          </div>
          <button
            onClick={handleFixedAdd}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/15 text-light-200/60 hover:text-light-100 hover:border-white/30 hover:bg-white/5 text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus size={15} />
            Agregar Ingrediente Fijo
          </button>
        </div>

        {optionGroups.length > 0 && (
          <div className="mb-5 space-y-3">
            <h4 className="text-sm font-semibold text-light-100">Ingredientes por Opción</h4>
            {optionGroups.map((g) => (
              <OptionGroupEditor
                key={g.id}
                group={g}
                groupDraft={groupsDraft[g.id] ?? { activeOptionId: g.options?.[0]?.id ?? null, options: {} }}
                materials={materials}
                onSelectOption={handleSelectOption}
                onUpdateIngredient={handleGroupUpdate}
                onAddIngredient={handleGroupAdd}
                onRemoveIngredient={handleGroupRemove}
              />
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-main-500/20 bg-main-500/5 p-4 space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-light-200/70">Costo Base (fijo)</span>
            <span className="font-semibold text-light-100 tabular-nums">{formatMoney(fixedCogs)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-light-200/70">{hasRange ? 'Rango de COGS Total' : 'COGS Total'}</span>
            <span className="font-semibold text-light-100 tabular-nums">
              {hasRange ? `${formatMoney(totalMinCogs)} – ${formatMoney(totalMaxCogs)}` : formatMoney(totalMinCogs)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-light-200/70">Precio de Venta</span>
            <span className="font-semibold text-light-100 tabular-nums">{formatMoney(sellingPrice)}</span>
          </div>
          <div className="flex items-center justify-between text-sm pt-1.5 border-t border-white/10">
            <span className="text-light-200/70">{hasRange ? 'Rango de Margen' : 'Margen de Ganancia'}</span>
            <span className={`font-bold tabular-nums ${marginColor(minMarginPercent)}`}>
              {hasRange ? `${minMarginPercent.toFixed(1)}% – ${maxMarginPercent.toFixed(1)}%` : `${maxMarginPercent.toFixed(1)}%`}
            </span>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-light-200/70 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-main-500 hover:bg-main-400 text-snow flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : 'Guardar Receta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── View Recipe Modal (read-only) ────────────────────────────────────────────
const ViewRecipeModal = ({ product, recipe, onClose, onEdit }) => {
  const optionGroups = Array.isArray(product.optionGroups) ? product.optionGroups : []
  const [activeByGroup, setActiveByGroup] = useState(() =>
    Object.fromEntries(optionGroups.map((g) => [g.id, g.options?.[0]?.id ?? null]))
  )

  const hasRecipe = Boolean(recipe?.fixedIngredients?.length)
  const hasRange = optionGroups.length > 0 && hasRecipe && recipe.minCogs !== recipe.maxCogs

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-main-900 border border-white/10 rounded-3xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-light-100">{product.name}</h3>
            <p className="text-xs text-light-200/65 mt-0.5">Precio de venta: {formatMoney(product.price || 0)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-xl hover:bg-white/5 text-light-200/70 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {!hasRecipe ? (
          <p className="text-sm text-light-200/55 italic text-center py-8">Este producto no tiene receta.</p>
        ) : (
          <>
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-light-100 mb-2">Ingredientes Fijos</h4>
              <div className="space-y-2">
                {recipe.fixedIngredients.map((ing, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-light-100 truncate">{ing.materialName}</p>
                      <p className="text-xs text-light-200/65 mt-0.5">
                        {ing.quantity} {unitLabel(ing.unit)}
                        {ing.materialUnit && ing.unit !== ing.materialUnit && (
                          <> ({formatQty(ing.quantityInMaterialUnit)} {unitLabel(ing.materialUnit)})</>
                        )}
                        {' '}× {formatMoney(ing.unitCost)}/{unitShort(ing.materialUnit || ing.unit) || unitLabel(ing.materialUnit || ing.unit)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-light-100 tabular-nums shrink-0">{formatMoney(ing.totalCost)}</p>
                  </div>
                ))}
              </div>
            </div>

            {optionGroups.map((g) => {
              const activeId = activeByGroup[g.id] ?? g.options?.[0]?.id
              const optionData = recipe.optionIngredients?.[g.id]?.options?.[activeId]
              const completedKeys = new Set(
                (g.options || [])
                  .filter((o) => (recipe.optionIngredients?.[g.id]?.options?.[o.id]?.ingredients?.length ?? 0) > 0)
                  .map((o) => o.id)
              )
              return (
                <div key={g.id} className="mb-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <h4 className="text-sm font-semibold text-light-100 mb-2">{g.name || 'Grupo sin nombre'}</h4>
                  <VariationTabs
                    options={g.options || []}
                    activeKey={activeId}
                    completedKeys={completedKeys}
                    onSelect={(id) => setActiveByGroup((prev) => ({ ...prev, [g.id]: id }))}
                  />
                  {!optionData || optionData.ingredients.length === 0 ? (
                    <p className="text-xs text-light-200/55 italic py-2">Sin ingredientes extra para esta opción.</p>
                  ) : (
                    <div className="space-y-2">
                      {optionData.ingredients.map((ing, idx) => (
                        <div key={idx} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-light-100 truncate">{ing.materialName}</p>
                            <p className="text-[11px] text-light-200/65">
                              {ing.quantity} {unitLabel(ing.unit)}
                              {ing.materialUnit && ing.unit !== ing.materialUnit && (
                                <> ({formatQty(ing.quantityInMaterialUnit)} {unitLabel(ing.materialUnit)})</>
                              )}
                              {' '}× {formatMoney(ing.unitCost)}/{unitShort(ing.materialUnit || ing.unit) || unitLabel(ing.materialUnit || ing.unit)}
                            </p>
                          </div>
                          <p className="text-xs font-semibold text-light-100 tabular-nums shrink-0">{formatMoney(ing.totalCost)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            <div className="rounded-2xl border border-main-500/20 bg-main-500/5 p-4 space-y-1.5 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-light-200/70">{hasRange ? 'Rango de COGS' : 'Total COGS'}</span>
                <span className="font-semibold text-light-100 tabular-nums">
                  {hasRange ? `${formatMoney(recipe.minCogs)} – ${formatMoney(recipe.maxCogs)}` : formatMoney(recipe.minCogs)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-1.5 border-t border-white/10">
                <span className="text-light-200/70">{hasRange ? 'Rango de Margen' : 'Margen de Ganancia'}</span>
                <span className={`font-bold tabular-nums ${marginColor(recipe.minMarginPercent)}`}>
                  {hasRange ? `${recipe.minMarginPercent.toFixed(1)}% – ${recipe.maxMarginPercent.toFixed(1)}%` : `${recipe.maxMarginPercent.toFixed(1)}%`}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-light-200/70 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            onClick={onEdit}
            className="flex-1 rounded-xl bg-main-500 hover:bg-main-400 py-2.5 text-sm font-bold text-snow transition-colors cursor-pointer"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Recipe Row ────────────────────────────────────────────────────────────────
const RecipeRow = ({ product, recipe, onEdit, onView, onDelete }) => {
  const summary = getRecipeSummary(product, recipe)

  return (
    <div className="px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-white/5 transition-colors">
      <div className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 bg-main-800 text-main-400">
        <BookOpen size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-light-100 truncate">{product.name}</p>
        <p className="text-xs text-light-200/65 mt-0.5 truncate">
          {product.section || 'Sin sección'}
          {!summary.hasRecipe && <span className="text-amber-400"> · Sin receta</span>}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-5 shrink-0 text-right">
        <div className="w-20">
          <p className="text-xs text-light-200/65">Precio</p>
          <p className="text-sm font-bold text-light-100 tabular-nums">{formatMoney(product.price || 0)}</p>
        </div>
        <div className="w-28">
          <p className="text-xs text-light-200/65">{summary.hasRange ? 'COGS (rango)' : 'COGS'}</p>
          <p className="text-sm font-semibold text-light-200/70 tabular-nums">
            {!summary.hasRecipe ? '—' : summary.hasRange ? `${formatMoney(summary.minCogs)}–${formatMoney(summary.maxCogs)}` : formatMoney(summary.minCogs)}
          </p>
        </div>
        <div className="w-24">
          <p className="text-xs text-light-200/65">{summary.hasRange ? 'Margen (rango)' : 'Margen'}</p>
          <p className={`text-sm font-bold tabular-nums flex items-center justify-end gap-1 ${marginColor(summary.hasRecipe ? summary.minMargin : null)}`}>
            {summary.hasRecipe && summary.minMargin < 0 && <AlertTriangle size={11} />}
            {!summary.hasRecipe ? '—' : summary.hasRange ? `${summary.minMargin.toFixed(1)}–${summary.maxMargin.toFixed(1)}%` : `${summary.maxMargin.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {summary.hasRecipe ? (
          <>
            <button
              onClick={onView}
              aria-label={`Ver receta de ${product.name}`}
              className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-light-200/70 hover:text-light-100 transition-colors cursor-pointer"
            >
              <Eye size={14} />
            </button>
            <button
              onClick={onEdit}
              aria-label={`Editar receta de ${product.name}`}
              className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-light-200/70 hover:text-light-100 transition-colors cursor-pointer"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              aria-label={`Eliminar receta de ${product.name}`}
              className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-light-200/70 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-main-500 hover:bg-main-400 text-snow text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus size={13} />
            Crear receta
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Recipes Section ────────────────────────────────────────────────────────────
const RecipesSection = ({ materials }) => {
  const [products, setProducts] = useState([])
  const [recipes, setRecipes] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef(null)
  const [editTarget, setEditTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (!successMsg) return
    const timer = setTimeout(() => setSuccessMsg(''), 4000)
    return () => clearTimeout(timer)
  }, [successMsg])

  useEffect(() => {
    const handler = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsubProducts = null
    let unsubRecipes = null
    const timer = setTimeout(() => {
      if (cancelled) return
      unsubProducts = onSnapshot(
        collection(db, 'products'),
        (snap) => { if (alive) setProducts(snap.docs.map((d) => ({ docId: d.id, ...d.data() }))) },
        () => { if (alive) setLoadError('No se pudieron cargar los productos.') }
      )
      unsubRecipes = onSnapshot(
        collection(db, 'recipes'),
        (snap) => {
          if (!alive) return
          const map = {}
          snap.docs.forEach((d) => { map[d.id] = { docId: d.id, ...d.data() } })
          setRecipes(map)
          setLoading(false)
        },
        () => { if (alive) { setLoadError('No se pudieron cargar las recetas.'); setLoading(false) } }
      )
    }, 0)
    return () => {
      cancelled = true
      alive = false
      clearTimeout(timer)
      if (unsubProducts) try { unsubProducts() } catch { /* noop */ }
      if (unsubRecipes) try { unsubRecipes() } catch { /* noop */ }
    }
  }, [])

  const rows = products
    .filter((p) => (p.name || '').toLowerCase().includes(search.trim().toLowerCase()))
    .map((p) => ({ product: p, recipe: recipes[p.docId] ?? null }))

  const sortField = sortKey === 'cogs' ? 'minCogs' : 'minMarginPercent'
  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a.recipe?.[sortField]
        const bv = b.recipe?.[sortField]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        // "Mayor COGS" wants highest first; "Menor margen" wants lowest (riskiest) first.
        return sortKey === 'margin' ? av - bv : bv - av
      })
    : [...rows].sort((a, b) => String(a.product.name || '').localeCompare(String(b.product.name || '')))

  const handleDeleteRecipe = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'recipes', deleteTarget.docId))
      setDeleteTarget(null)
    } catch {
      setLoadError('No se pudo eliminar la receta.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-main-800 border border-white/10 flex items-center justify-center text-main-400 shrink-0">
          <BookOpen size={18} />
        </div>
        <div>
          <h2 className="text-base font-bold text-light-100">Recetas</h2>
          <p className="text-xs text-light-200/65 mt-0.5">
            Indica qué insumos (y cuánto) lleva cada producto. Con eso calculamos cuánto te cuesta, cuánto ganas y descontamos el inventario en cada venta. Un producto sin receta cuenta como costo $0 en Finanzas.
          </p>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}
      {successMsg && (
        <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
          <Check size={16} className="shrink-0" />
          {successMsg}
        </div>
      )}

      <div className="bg-main-900 border border-white/10 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/55" />
            <input
              type="text"
              placeholder="Buscar producto por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-main-800/60 border border-white/10 rounded-xl text-sm text-light-100 placeholder:text-light-200/55 outline-none focus:border-main-500/40 transition-colors"
            />
          </div>
          <div className="relative shrink-0" ref={sortRef}>
            <button
              onClick={() => setSortOpen((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                sortKey
                  ? 'bg-main-500/20 border-main-500/40 text-main-400'
                  : 'bg-main-800/60 border-white/10 text-light-200/70 hover:bg-white/5 hover:text-light-100'
              }`}
            >
              <ChevronsUpDown size={15} />
              <span className="hidden sm:inline">{RECIPE_SORT_OPTIONS.find((o) => o.key === sortKey)?.label}</span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-main-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-1.5 overflow-hidden">
                {RECIPE_SORT_OPTIONS.map((opt) => (
                  <button
                    key={String(opt.key)}
                    onClick={() => { setSortKey(opt.key); setSortOpen(false) }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer ${
                      sortKey === opt.key
                        ? 'bg-main-500/20 text-main-400 font-semibold'
                        : 'text-light-200/60 hover:bg-white/5 hover:text-light-100'
                    }`}
                  >
                    {opt.label}
                    {sortKey === opt.key && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-white/10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-white/5 animate-pulse" />
                  <div className="h-2.5 w-24 rounded bg-white/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-light-200/55">
            <BookOpen size={40} />
            <p className="text-sm italic">
              {search ? 'Sin resultados para esa búsqueda.' : 'No hay recetas creadas. Crea la primera seleccionando un producto abajo.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {sorted.map(({ product, recipe }) => (
              <RecipeRow
                key={product.docId}
                product={product}
                recipe={recipe}
                onEdit={() => setEditTarget(product)}
                onView={() => setViewTarget(product)}
                onDelete={() => setDeleteTarget(product)}
              />
            ))}
          </div>
        )}
      </div>

      {editTarget && (
        <RecipeEditorModal
          product={editTarget}
          existingRecipe={recipes[editTarget.docId] ?? null}
          materials={materials}
          onClose={() => setEditTarget(null)}
          onSuccess={setSuccessMsg}
        />
      )}

      {viewTarget && (
        <ViewRecipeModal
          product={viewTarget}
          recipe={recipes[viewTarget.docId] ?? null}
          onClose={() => setViewTarget(null)}
          onEdit={() => { setEditTarget(viewTarget); setViewTarget(null) }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          label={`¿Seguro que deseas eliminar la receta de "${deleteTarget.name}"? El producto seguirá en el menú.`}
          onConfirm={handleDeleteRecipe}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}

// ─── Material Row ─────────────────────────────────────────────────────────────
const MaterialRow = ({ material, onEdit, onDelete }) => {
  const lastUpdatedDate = material.lastUpdated?.toDate?.() ?? material.createdAt?.toDate?.() ?? null
  const reorderLevel = material.reorderLevel ?? 0
  const currentStock = material.currentStock ?? 0
  const isLow = reorderLevel > 0 && currentStock <= reorderLevel

  const metaParts = [`${formatMoney(material.costPerUnit || 0)} por ${unitLabel(material.unit).toLowerCase()}`]
  if (material.supplier) metaParts.push(material.supplier)
  metaParts.push(formatRelative(lastUpdatedDate))

  return (
    <div className="px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-white/5 transition-colors">
      <div
        className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 ${
          isLow ? 'bg-amber-500/15 text-amber-400' : 'bg-main-800 text-main-400'
        }`}
      >
        <Package size={18} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-light-100 truncate">{material.name}</p>
        <p className="text-xs text-light-200/65 mt-0.5 truncate">
          {metaParts.join(' · ')}
          {reorderLevel > 0 && <span className="text-light-200/65"> · avisa al llegar a {formatQty(reorderLevel)} {unitShort(material.unit)}</span>}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-[11px] font-semibold text-light-200/60">{currentStock <= 0 && reorderLevel > 0 ? 'Agotado' : 'Quedan'}</p>
        <p className={`text-sm font-bold tabular-nums flex items-center justify-end gap-1 ${
          isLow ? 'text-amber-400' : 'text-light-100'
        }`}>
          {isLow && <AlertTriangle size={12} aria-label="Por acabarse" />}
          {formatQty(currentStock)} {unitShort(material.unit)}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(material)}
          aria-label={`Editar ${material.name}`}
          className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-light-200/70 hover:text-light-100 transition-colors cursor-pointer"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => onDelete(material)}
          aria-label={`Eliminar ${material.name}`}
          className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-light-200/70 hover:text-red-400 transition-colors cursor-pointer"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── Stock View ────────────────────────────────────────────────────────────────
export const Stock = () => {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState(null) // null | 'add' | material object
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [purchaseSuccess, setPurchaseSuccess] = useState('')

  useEffect(() => {
    if (!purchaseSuccess) return
    const timer = setTimeout(() => setPurchaseSuccess(''), 4000)
    return () => clearTimeout(timer)
  }, [purchaseSuccess])

  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (cancelled) return
      unsub = onSnapshot(
        collection(db, 'rawMaterials'),
        (snap) => {
          if (!alive) return
          setMaterials(snap.docs.map((d) => ({ docId: d.id, ...d.data() })))
          setLoading(false)
          setLoadError('')
        },
        () => {
          if (!alive) return
          setLoadError('No se pudieron cargar los materiales.')
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

  const filtered = materials
    .filter((m) => {
      const term = search.trim().toLowerCase()
      if (!term) return true
      return (m.name || '').toLowerCase().includes(term)
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))

  const lowStockCount = materials.filter(isLowStock).length
  const [onlyLow, setOnlyLow] = useState(false)
  const shown = onlyLow ? filtered.filter(isLowStock) : filtered

  // Insumos | Recetas — remembered on this device.
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('bk_stock_tab') === 'recetas' ? 'recetas' : 'insumos' } catch { return 'insumos' }
  })
  const selectTab = (t) => {
    setTab(t)
    try { localStorage.setItem('bk_stock_tab', t) } catch { /* private mode */ }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'rawMaterials', deleteTarget.docId))
      setDeleteTarget(null)
    } catch {
      setLoadError('No se pudo eliminar el material.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div role="tablist" aria-label="Inventario" className="flex items-center gap-1 p-1 rounded-xl bg-main-900 border border-white/10 w-fit">
        {[
          { key: 'insumos', label: 'Insumos', icon: Boxes },
          { key: 'recetas', label: 'Recetas', icon: BookOpen },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => selectTab(key)}
            className={`inline-flex items-center gap-2 min-h-[40px] px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              tab === key ? 'bg-main-500 text-snow' : 'text-light-200/70 hover:text-light-100'
            }`}
          >
            <Icon size={16} /> {label}
            {key === 'insumos' && lowStockCount > 0 && <AlertTriangle size={14} className={tab === key ? 'text-snow' : 'text-amber-400'} aria-label="Hay insumos por agotarse" />}
          </button>
        ))}
      </div>

      {tab === 'recetas' ? (
        <RecipesSection materials={materials} />
      ) : (
      <>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-main-900 border border-white/10 rounded-3xl p-5">
          <p className="text-sm font-semibold text-light-200/75">Insumos registrados</p>
          <p className="text-3xl font-bold text-light-100 mt-1">{loading ? '—' : materials.length}</p>
          <p className="text-xs text-light-200/60 mt-1">Todo lo que compras para preparar tus productos.</p>
        </div>
        <button
          type="button"
          onClick={() => setOnlyLow((v) => !v)}
          disabled={lowStockCount === 0}
          aria-pressed={onlyLow}
          className={`text-left rounded-3xl p-5 border transition-colors cursor-pointer disabled:cursor-default ${
            onlyLow ? 'bg-amber-500/10 border-amber-500/40' : 'bg-main-900 border-white/10 hover:border-amber-500/30'
          }`}
        >
          <p className="text-sm font-semibold text-light-200/75 flex items-center gap-1.5">
            {lowStockCount > 0 && <AlertTriangle size={14} className="text-amber-400" />} Por acabarse
          </p>
          <p className={`text-3xl font-bold mt-1 ${lowStockCount > 0 ? 'text-amber-400' : 'text-light-100'}`}>
            {loading ? '—' : lowStockCount}
          </p>
          <p className="text-xs text-light-200/60 mt-1">
            {lowStockCount === 0 ? 'Todo arriba de su nivel de aviso.' : onlyLow ? 'Mostrando solo estos. Toca para ver todos.' : 'Toca para ver solo estos.'}
          </p>
        </button>
        <div className="bg-main-900 border border-white/10 rounded-3xl p-5 flex flex-col justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-light-200/75">¿Compraste algo?</p>
            <p className="text-xs text-light-200/60 mt-1">Regístralo para sumar al inventario. Si es algo nuevo, primero créalo.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPurchaseModalOpen(true)}
              disabled={!materials.length}
              className="flex-1 flex items-center justify-center gap-2 px-3 min-h-[44px] rounded-xl bg-main-500 hover:bg-main-400 text-snow text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PackagePlus size={16} />
              Registrar compra
            </button>
            <button
              onClick={() => setModalMode('add')}
              className="flex items-center justify-center gap-2 px-3 min-h-[44px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-light-100 text-sm font-semibold transition-colors cursor-pointer shrink-0"
            >
              <Plus size={16} />
              Nuevo insumo
            </button>
          </div>
        </div>
      </div>

      {purchaseSuccess && (
        <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
          <Check size={16} className="shrink-0" />
          {purchaseSuccess}
        </div>
      )}

      {loadError && (
        <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {/* Search + list */}
      <div className="bg-main-900 border border-white/10 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/55" />
            <input
              type="text"
              placeholder="Buscar insumo por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-main-800/60 border border-white/10 rounded-xl text-sm text-light-100 placeholder:text-light-200/55 outline-none focus:border-main-500/40 transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-white/10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-white/5 animate-pulse" />
                  <div className="h-2.5 w-24 rounded bg-white/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-light-200/55">
            <Boxes size={40} />
            <p className="text-sm italic">
              {search ? 'Sin resultados para esa búsqueda.' : 'Aún no registras insumos. Empieza por lo que más usas: leche, vasos, café…'}
            </p>
            {!search && (
              <button
                onClick={() => setModalMode('add')}
                className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-main-500 hover:bg-main-400 text-snow text-sm font-semibold transition-colors cursor-pointer"
              >
                <Plus size={15} />
                Agregar el primero
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {shown.map((m) => (
              <MaterialRow key={m.docId} material={m} onEdit={setModalMode} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </div>

      {modalMode && (
        <MaterialModal
          material={modalMode === 'add' ? null : modalMode}
          onClose={() => setModalMode(null)}
        />
      )}

      {purchaseModalOpen && (
        <AddStockPurchaseModal
          materials={materials}
          onClose={() => setPurchaseModalOpen(false)}
          onSuccess={setPurchaseSuccess}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          label={`¿Seguro que deseas eliminar "${deleteTarget.name}"? Las recetas que lo usan dejarán de descontarlo. Esta acción no se puede deshacer.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
      </>
      )}
    </div>
  )
}
