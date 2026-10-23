/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../firebase'
import { formatMoney } from '../../../utils/cart'
import { MoneyInput } from '../../MoneyInput'
import { ConfirmDialog } from '../ConfirmDialog'
import { computeTotals, daysUntilDue } from '../../../utils/expenses'
import { Wallet, Plus, Pencil, Trash2, CalendarClock } from 'lucide-react'

const inputCls =
  'w-full rounded-xl border border-white/10 bg-main-900 px-3 py-2.5 text-sm text-light-100 placeholder-light-200/55 outline-none transition focus:border-main-500/50 focus:ring-1 focus:ring-main-500/20'
const labelCls = 'block text-xs font-medium text-light-200/60 mb-1.5'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DeleteConfirm = ({ label, onConfirm, onCancel, loading }) => (
  <ConfirmDialog title="¿Eliminar gasto?" message={label} onConfirm={onConfirm} onCancel={onCancel} isPending={loading} />
)

const PeriodPills = ({ value, onChange }) => (
  <div className="flex items-center gap-1 p-1 rounded-xl bg-main-900 border border-white/10 w-fit">
    {[{ key: 'monthly', label: 'Mensual' }, { key: 'annual', label: 'Anual' }].map((opt) => (
      <button
        key={opt.key}
        type="button"
        onClick={() => onChange(opt.key)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
          value === opt.key ? 'bg-main-500 text-snow' : 'text-light-200/70 hover:text-light-100'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
)

const ExpenseForm = ({ expense, onSaved, onCancel }) => {
  const isEdit = Boolean(expense)
  const [name, setName] = useState(expense?.name || '')
  const [amount, setAmount] = useState(expense?.amount ?? 0)
  const [period, setPeriod] = useState(expense?.period || 'monthly')
  const [dueDay, setDueDay] = useState(expense?.dueDay ?? 1)
  const [dueMonth, setDueMonth] = useState(expense?.dueMonth ?? new Date().getMonth() + 1)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  const handleSave = async () => {
    const trimmedName = name.trim()
    const amt = Number(amount)
    if (!trimmedName || !Number.isFinite(amt) || amt <= 0) {
      setError('Nombre y monto válido son obligatorios.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const day = Math.min(31, Math.max(1, Math.round(Number(dueDay)) || 1))
      const payload = {
        name: trimmedName,
        amount: amt,
        period,
        dueDay: day,
        dueMonth: period === 'annual' ? Math.min(12, Math.max(1, Math.round(Number(dueMonth)) || 1)) : null,
        updatedAt: serverTimestamp(),
      }
      if (isEdit) {
        await updateDoc(doc(db, 'expenses', expense.docId), payload)
      } else {
        await addDoc(collection(db, 'expenses'), { ...payload, createdAt: serverTimestamp() })
      }
      onSaved()
    } catch {
      setError(isEdit ? 'No se pudo actualizar el gasto.' : 'No se pudo guardar el gasto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <div>
        <label className={labelCls}>Nombre *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Renta del local"
          autoFocus
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Monto *</label>
          <MoneyInput value={amount} onChange={setAmount} inputClassName={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Periodo *</label>
          <PeriodPills value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Día de vencimiento *</label>
          <select value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputCls}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        {period === 'annual' && (
          <div>
            <label className={labelCls}>Mes de vencimiento *</label>
            <select value={dueMonth} onChange={(e) => setDueMonth(e.target.value)} className={inputCls}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-light-200/70 hover:bg-white/10 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-main-500 hover:bg-main-400 py-2.5 text-sm font-semibold text-snow transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Agregar gasto'}
        </button>
      </div>
    </div>
  )
}

const ExpenseRow = ({ expense, onEdit, onDelete }) => {
  const due = daysUntilDue(expense)
  const dueLabel = due === 0 ? 'Vence hoy' : due === 1 ? 'Vence mañana' : due > 0 ? `Vence en ${due}d` : `Venció hace ${Math.abs(due)}d`
  const dueColorCls = due <= 0 ? 'text-rose-400' : due <= 7 ? 'text-amber-400' : 'text-light-200/65'

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-light-100 truncate">{expense.name}</p>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/5 text-light-200/70 border border-white/10 shrink-0">
            {expense.period === 'annual' ? 'Anual' : 'Mensual'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs">
          <span className="tabular-nums font-medium text-light-100">{formatMoney(expense.amount)}</span>
          <span className={`flex items-center gap-1 ${dueColorCls}`}>
            <CalendarClock size={11} /> {dueLabel}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          aria-label={`Editar ${expense.name}`}
          className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-white/5 text-light-200/70 hover:text-light-100 transition-colors cursor-pointer"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          aria-label={`Eliminar ${expense.name}`}
          className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-light-200/70 hover:text-red-400 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// Owns the `expenses` Firestore collection (CRUD) and reports the computed
// daily/monthly/annual totals up to BreakEvenAnalysis via onTotalsChange, so the
// break-even calculator runs off real tracked expenses instead of a manual guess.
export const ExpenseManager = ({ onTotalsChange }) => {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (cancelled) return
      unsub = onSnapshot(
        collection(db, 'expenses'),
        (snap) => {
          if (!alive) return
          setExpenses(snap.docs.map((d) => ({ docId: d.id, ...d.data() })))
          setLoading(false)
          setLoadError('')
        },
        () => {
          if (!alive) return
          setLoadError('Error cargando gastos fijos.')
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

  const totals = useMemo(() => computeTotals(expenses), [expenses])

  useEffect(() => { onTotalsChange?.(totals) }, [totals, onTotalsChange])

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => daysUntilDue(a) - daysUntilDue(b)),
    [expenses]
  )

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'expenses', deleteTarget.docId))
      setDeleteTarget(null)
    } catch {
      setLoadError('No se pudo eliminar el gasto.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-main-900 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Wallet size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-light-100">Gastos Fijos</h3>
            <p className="text-xs text-light-200/65">Renta, servicios, nómina y otros gastos recurrentes</p>
          </div>
        </div>
        {!showForm && !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-main-500 hover:bg-main-400 text-snow text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus size={14} /> Agregar gasto
          </button>
        )}
      </div>

      {loadError && <p className="text-xs text-red-400">{loadError}</p>}

      {showForm && (
        <ExpenseForm onSaved={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        !showForm && (
          <div className="py-8 flex flex-col items-center gap-2 text-light-200/55 text-center">
            <Wallet size={28} />
            <p className="text-xs italic max-w-xs">
              Aún no has agregado gastos fijos. Agrega renta, servicios, nómina, etc. para calcular tu punto de equilibrio real.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {sorted.map((exp) => (
            editing?.docId === exp.docId ? (
              <ExpenseForm key={exp.docId} expense={exp} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
            ) : (
              <ExpenseRow key={exp.docId} expense={exp} onEdit={() => setEditing(exp)} onDelete={() => setDeleteTarget(exp)} />
            )
          ))}
        </div>
      )}

      {expenses.length > 0 && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-light-200/65 truncate">Total mensual</p>
            <p className="text-sm font-bold text-light-100 tabular-nums truncate">{formatMoney(totals.monthlyTotal)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-light-200/65 truncate">Total anual</p>
            <p className="text-sm font-bold text-light-100 tabular-nums truncate">{formatMoney(totals.annualTotal)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-light-200/65 truncate">Equivalente diario</p>
            <p className="text-sm font-bold text-amber-400 tabular-nums truncate">{formatMoney(totals.dailyFixedCosts)}</p>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirm
          label={`Se eliminará "${deleteTarget.name}" de tus gastos fijos.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}
