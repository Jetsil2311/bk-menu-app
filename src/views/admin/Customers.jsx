import { useState, useEffect, useRef } from 'react'
import {
  collection, onSnapshot, updateDoc, doc, query, orderBy,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { formatMoney } from '../../utils/cart'
import {
  Users, Search, Phone, Star, ShoppingBag, Plus, Minus,
  ChevronRight, X, Check, ChevronsUpDown,
} from 'lucide-react'

const SORT_OPTIONS = [
  { key: null,        label: 'Sin orden' },
  { key: 'balance',   label: 'Mayor balance' },
  { key: 'createdAt', label: 'Cliente más antiguo' },
  { key: 'visitCount',label: 'Más visitas' },
  { key: 'lastVisit', label: 'Última visita reciente' },
]

function applySortKey(arr, key) {
  if (!key) return arr
  return [...arr].sort((a, b) => {
    const toNum = (c, k) => {
      if (k === 'balance')    return c.loyaltyBalance ?? null
      if (k === 'visitCount') return c.visitCount ?? null
      return null
    }
    const toDate = (c, k) => {
      const v = k === 'createdAt' ? c.createdAt : c.lastVisit
      return v?.toDate?.() ?? null
    }

    if (key === 'balance' || key === 'visitCount') {
      const na = toNum(a, key), nb = toNum(b, key)
      if (na === null && nb === null) return 0
      if (na === null) return 1
      if (nb === null) return -1
      return nb - na  // highest first
    }
    if (key === 'createdAt' || key === 'lastVisit') {
      const da = toDate(a, key), db_ = toDate(b, key)
      if (da === null && db_ === null) return 0
      if (da === null) return 1
      if (db_ === null) return -1
      return key === 'createdAt'
        ? da - db_    // oldest first
        : db_ - da    // most recent first
    }
    return 0
  })
}

// ─── Balance Adjustment Modal ─────────────────────────────────────────────────

const BalanceModal = ({ customer, onClose }) => {
  const [mode, setMode] = useState('add') // 'add' | 'subtract'
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // Keyboard: Escape closes, Enter confirms
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Enter') { handleSave() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  })

  const handleSave = async () => {
    const num = parseFloat(amount)
    if (!num || num <= 0) return
    setSaving(true)
    try {
      const delta = mode === 'add' ? num : -num
      const next = Math.max(0, (customer.loyaltyBalance || 0) + delta)
      await updateDoc(doc(db, 'customers', customer.id), { loyaltyBalance: next })
      setDone(true)
      setTimeout(onClose, 800)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-main-900 border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-light-100">Ajustar Saldo</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-light-200/50 cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-light-200/60 mb-1">{customer.name}</p>
        <p className="text-xs text-light-200/40 mb-4">Saldo actual: {formatMoney(customer.loyaltyBalance || 0)}</p>

        <div className="flex gap-2 mb-4">
          {['add', 'subtract'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer border ${
                mode === m
                  ? m === 'add'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-white/5 border-white/5 text-light-200/40 hover:bg-white/10'
              }`}
            >
              {m === 'add' ? <Plus size={14} /> : <Minus size={14} />}
              {m === 'add' ? 'Agregar' : 'Descontar'}
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/40 text-sm">$</span>
          <input
            type="number"
            min="0"
            step="0.50"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-7 pr-4 py-2.5 bg-main-800 border border-white/10 rounded-xl text-sm text-light-100 outline-none focus:border-main-500/60 transition-colors"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || done || !amount || parseFloat(amount) <= 0}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-main-500 hover:bg-main-400 text-white flex items-center justify-center gap-2"
        >
          {done ? <><Check size={16} /> Guardado</> : saving ? 'Guardando…' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}

// ─── Customer Row ─────────────────────────────────────────────────────────────

const CustomerRow = ({ customer, onSelectAdjust }) => {
  const [open, setOpen] = useState(false)

  const joinedStr = customer.createdAt instanceof Date
    ? customer.createdAt.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
    : customer.createdAt?.toDate?.()?.toLocaleDateString?.('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) ?? '—'

  return (
    <>
      <div
        className="px-5 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors group cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        {/* Avatar */}
        <div className="h-10 w-10 rounded-2xl bg-main-800 border border-white/5 flex items-center justify-center text-main-400 font-bold text-sm shrink-0 select-none">
          {(customer.name || '?')[0].toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-light-100 truncate">{customer.name || 'Sin nombre'}</p>
          <p className="text-xs text-light-200/40 flex items-center gap-1 mt-0.5">
            <Phone size={10} />
            {customer.phone || '—'}
          </p>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-xs text-light-200/40">Visitas</p>
            <p className="text-sm font-bold text-light-100 flex items-center gap-1 justify-end">
              <ShoppingBag size={12} className="text-main-400" />
              {customer.visitCount || 0}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-light-200/40">Saldo</p>
            <p className="text-sm font-bold text-emerald-400">{formatMoney(customer.loyaltyBalance || 0)}</p>
          </div>
        </div>

        <ChevronRight
          size={16}
          className={`text-light-200/30 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-5 pb-4 border-t border-white/5 bg-white/[0.02]">
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-light-200/50">
            <span>Cliente desde: <span className="text-light-200/70">{joinedStr}</span></span>
            <span className="sm:hidden">Visitas: <span className="text-light-200/70">{customer.visitCount || 0}</span></span>
            <span className="sm:hidden">Saldo: <span className="text-emerald-400 font-semibold">{formatMoney(customer.loyaltyBalance || 0)}</span></span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onSelectAdjust(customer) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-main-500/20 border border-main-500/30 text-main-400 text-xs font-semibold hover:bg-main-500/30 transition-colors cursor-pointer"
            >
              <Star size={12} />
              Ajustar saldo
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Customers View ───────────────────────────────────────────────────────────

export const Customers = () => {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adjustTarget, setAdjustTarget] = useState(null)
  const [sortKey, setSortKey] = useState(null)
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (cancelled) return
      const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'))
      unsub = onSnapshot(q, (snap) => {
        if (!alive) return
        setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }, () => { if (alive) setLoading(false) })
    }, 0)
    return () => {
      cancelled = true
      alive = false
      clearTimeout(timer)
      if (unsub) try { unsub() } catch {}
    }
  }, [])

  const filtered = customers.filter((c) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.phone || '').includes(term)
    )
  })

  const sorted = applySortKey(filtered, sortKey)
  const activeSortLabel = SORT_OPTIONS.find(o => o.key === sortKey)?.label ?? 'Sin orden'

  const totalBalance = customers.reduce((s, c) => s + (c.loyaltyBalance || 0), 0)
  const totalVisits = customers.reduce((s, c) => s + (c.visitCount || 0), 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-main-900/50 border border-white/5 rounded-3xl p-5">
          <p className="text-xs text-light-200/40 uppercase tracking-wider">Clientes Registrados</p>
          <p className="text-3xl font-bold text-light-100 mt-2">{loading ? '—' : customers.length}</p>
        </div>
        <div className="bg-main-900/50 border border-white/5 rounded-3xl p-5">
          <p className="text-xs text-light-200/40 uppercase tracking-wider">Saldo Loyalty Total</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{loading ? '—' : formatMoney(totalBalance)}</p>
        </div>
        <div className="bg-main-900/50 border border-white/5 rounded-3xl p-5">
          <p className="text-xs text-light-200/40 uppercase tracking-wider">Total Visitas</p>
          <p className="text-3xl font-bold text-light-100 mt-2">{loading ? '—' : totalVisits.toLocaleString()}</p>
        </div>
      </div>

      {/* Search + list */}
      <div className="bg-main-900/30 border border-white/5 rounded-3xl overflow-hidden">
        {/* Search bar + sort */}
        <div className="p-4 border-b border-white/5 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/30" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-main-800/60 border border-white/5 rounded-xl text-sm text-light-100 placeholder:text-light-200/30 outline-none focus:border-main-500/40 transition-colors"
            />
          </div>

          {/* Sort popover */}
          <div className="relative shrink-0" ref={sortRef}>
            <button
              onClick={() => setSortOpen(v => !v)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                sortKey
                  ? 'bg-main-500/20 border-main-500/40 text-main-400'
                  : 'bg-main-800/60 border-white/5 text-light-200/50 hover:bg-white/5 hover:text-light-100'
              }`}
            >
              <ChevronsUpDown size={15} />
              <span className="hidden sm:inline">{activeSortLabel}</span>
              {sortKey && <span className="sm:hidden w-2 h-2 rounded-full bg-main-400" />}
            </button>

            {sortOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-main-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-1.5 overflow-hidden">
                {SORT_OPTIONS.map((opt) => (
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

        {/* List */}
        {loading ? (
          <div className="divide-y divide-white/5">
            {[1, 2, 3, 4].map(i => (
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
          <div className="py-16 flex flex-col items-center gap-3 text-light-200/30">
            <Users size={40} />
            <p className="text-sm italic">
              {search ? 'Sin resultados para esa búsqueda.' : 'No hay clientes registrados aún.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sorted.map((c) => (
              <CustomerRow key={c.id} customer={c} onSelectAdjust={setAdjustTarget} />
            ))}
          </div>
        )}
      </div>

      {adjustTarget && (
        <BalanceModal customer={adjustTarget} onClose={() => setAdjustTarget(null)} />
      )}
    </div>
  )
}
