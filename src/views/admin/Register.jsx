/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'
import {
  doc, onSnapshot, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { formatMoney } from '../../utils/cart'
import { MoneyInput } from '../../components/MoneyInput'
import { useRegister } from '../../hooks/useRegister'
import {
  LogIn, ArrowDownCircle, ArrowUpCircle, Lock,
  ChevronDown, ChevronUp, CheckCircle2, Banknote,
  CreditCard, Wallet, Clock, Calendar, AlertTriangle, Plus,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayKey = () => {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

const fmtDate = (dateStr) => {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

const fmtTime = (isoOrTs) => {
  if (!isoOrTs) return '—'
  try {
    const d = typeof isoOrTs === 'string' ? new Date(isoOrTs) : isoOrTs.toDate?.() ?? new Date(isoOrTs)
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

// ─── Past Session Row ─────────────────────────────────────────────────────────

export const PastSessionRow = ({ session }) => {
  const [open, setOpen] = useState(false)

  const totalWithdrawals = (session.withdrawals || []).reduce((s, w) => s + w.amount, 0)
  const totalDeposits    = (session.deposits    || []).reduce((s, d) => s + d.amount, 0)
  const expected = (session.openingFloat || 0) + (session.cashSales || 0) + totalDeposits - totalWithdrawals
  const closing  = session.closingCash ?? null
  const variance = closing !== null ? closing - expected : null

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer text-left"
      >
        <Calendar size={16} className="text-light-200/30 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-light-100 capitalize">{fmtDate(session.date)}</p>
          <p className="text-xs text-light-200/35 mt-0.5">
            Apertura: {formatMoney(session.openingFloat || 0)}
            {closing !== null && <> · Cierre: {formatMoney(closing)}</>}
          </p>
        </div>
        {variance !== null && (
          <span className={`text-sm font-bold tabular-nums shrink-0 ${Math.abs(variance) < 0.01 ? 'text-emerald-400' : variance > 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            {variance >= 0 ? '+' : ''}{formatMoney(variance)}
          </span>
        )}
        {open ? <ChevronUp size={15} className="text-light-200/30 shrink-0" /> : <ChevronDown size={15} className="text-light-200/30 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-4 grid grid-cols-2 gap-x-8 gap-y-2 text-xs border-t border-white/5 pt-4 bg-white/[0.01]">
          {[
            ['Fondo inicial',        formatMoney(session.openingFloat || 0), ''],
            ['Ventas efectivo',      formatMoney(session.cashSales || 0),    'text-emerald-400'],
            ['Ventas tarjeta',       formatMoney(session.cardSales || 0),    'text-blue-400'],
            ['Loyalty redimido',     formatMoney(session.loyaltyRedemptions || 0), 'text-amber-400'],
            ['Depósitos',            formatMoney(totalDeposits),             'text-emerald-400/70'],
            ['Retiros',              formatMoney(totalWithdrawals),          'text-rose-400'],
            ['Efectivo esperado',    formatMoney(expected),                  'text-light-100 font-semibold'],
            ['Efectivo contado',     closing !== null ? formatMoney(closing) : '—', 'text-light-100 font-semibold'],
            ['Varianza',             variance !== null ? `${variance >= 0 ? '+' : ''}${formatMoney(variance)}` : '—',
              variance === null ? '' : Math.abs(variance) < 0.01 ? 'text-emerald-400' : variance > 0 ? 'text-blue-400' : 'text-rose-400'],
          ].map(([label, val, cls]) => (
            <div key={label}>
              <span className="text-light-200/35">{label}: </span>
              <span className={cls || 'text-light-200/60'}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Register View ────────────────────────────────────────────────────────────

export const Register = () => {
  const { isRegisterOpen, openRegister, closeRegister, loading: sessionLoading } = useRegister()
  const [session, setSession] = useState(null)

  // Opening float modal (for when no session or closed today)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [openingFloat, setOpeningFloat] = useState(0)
  const [isOpening, setIsOpening]     = useState(false)

  // Active action: null | 'deposit' | 'withdraw' | 'close'
  const [activeAction, setActiveAction] = useState(null)
  const [actionAmount, setActionAmount] = useState(0)
  const [actionDesc, setActionDesc]   = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Close register
  const [closingCash, setClosingCash] = useState(0)

  // ── Listeners ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (cancelled) return
      unsub = onSnapshot(
        doc(db, 'register_sessions', todayKey()),
        snap => { if (alive) setSession(snap.exists() ? { id: snap.id, ...snap.data() } : null) },
      )
    }, 0)
    return () => {
      cancelled = true
      alive = false
      clearTimeout(timer)
      if (unsub) try { unsub() } catch {}
    }
  }, [])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!showOpenModal && !activeAction) return
    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (showOpenModal) { setShowOpenModal(false); return }
      if (activeAction) setActiveAction(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showOpenModal, activeAction])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleOpenRegister = async () => {
    if (openingFloat < 0 || isOpening) return
    setIsOpening(true)
    try {
      await openRegister(openingFloat)
      setShowOpenModal(false)
    } finally { setIsOpening(false) }
  }

  const submitAction = async () => {
    if (!actionAmount || actionAmount <= 0 || isSubmitting) return
    setIsSubmitting(true)
    try {
      const entry = {
        amount: actionAmount,
        description: actionDesc.trim() || (activeAction === 'deposit' ? 'Depósito' : 'Retiro'),
        ts: new Date().toISOString(),
      }
      const field = activeAction === 'deposit' ? 'deposits' : 'withdrawals'
      await updateDoc(doc(db, 'register_sessions', todayKey()), {
        [field]: [...(session?.[field] || []), entry],
      })
      setActionAmount(0)
      setActionDesc('')
      setActiveAction(null)
    } finally { setIsSubmitting(false) }
  }

  const handleCloseRegister = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await closeRegister(closingCash)
      setClosingCash(0)
      setActiveAction(null)
    } finally { setIsSubmitting(false) }
  }

  const toggleAction = (action) => {
    setActiveAction(prev => (prev === action ? null : action))
    setActionAmount(0)
    setActionDesc('')
    setClosingCash(0)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const totalDeposits    = (session?.deposits    || []).reduce((s, d) => s + d.amount, 0)
  const totalWithdrawals = (session?.withdrawals || []).reduce((s, w) => s + w.amount, 0)
  const theoreticalBalance = (session?.openingFloat || 0) + (session?.cashSales || 0) + totalDeposits - totalWithdrawals

  const expected = theoreticalBalance
  const variance = session ? closingCash - expected : 0

  const transactions = [
    ...(session?.deposits    || []).map(d => ({ ...d, type: 'deposit' })),
    ...(session?.withdrawals || []).map(w => ({ ...w, type: 'withdrawal' })),
  ].sort((a, b) => new Date(a.ts) - new Date(b.ts))

  const isClosedToday = session?.isClosed

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (sessionLoading) return (
    <div className="flex items-center justify-center h-64 text-light-200/30 text-sm animate-pulse">Cargando caja…</div>
  )

  // ── Shared Open Modal ────────────────────────────────────────────────────────
  const openModal = showOpenModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-main-950/80" onClick={() => setShowOpenModal(false)} />
      <div
        className="relative w-full max-w-md scale-100 transform overflow-hidden rounded-3xl border border-white/10 bg-main-900 p-8 shadow-2xl transition-all"
        onKeyDown={e => { if (e.key === 'Enter' && !isOpening) { e.preventDefault(); handleOpenRegister() } }}
      >
        <h3 className="mb-6 text-2xl font-bold text-light-100">Abrir Caja</h3>
        <p className="mb-6 text-sm text-light-200/40">Ingresa el fondo inicial de efectivo para comenzar el día</p>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-left block text-xs font-medium text-light-200/40 uppercase tracking-wider">
              Fondo inicial
            </label>
            <MoneyInput
              autoFocus
              value={openingFloat}
              onChange={setOpeningFloat}
              inputClassName="w-full rounded-2xl border border-white/10 bg-main-800 px-6 py-4 text-2xl font-bold text-light-100 outline-none transition-all focus:border-main-500/50 focus:ring-4 focus:ring-main-500/10"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowOpenModal(false)}
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-semibold text-light-200 transition hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              onClick={handleOpenRegister}
              disabled={isOpening}
              className="flex-1 rounded-2xl bg-main-500 px-6 py-4 font-bold text-white transition hover:bg-main-400 disabled:opacity-40"
            >
              {isOpening ? 'Abriendo…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── No session today ─────────────────────────────────────────────────────────
  if (!session) return (
    <div className="flex flex-col items-center justify-center gap-6 max-w-sm mx-auto pt-16 animate-in fade-in duration-300">
      <div className="h-16 w-16 rounded-3xl bg-main-900/50 border border-white/5 flex items-center justify-center">
        <LogIn size={28} className="text-main-400" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-light-100">Caja sin abrir</h2>
        <p className="mt-1 text-sm text-light-200/40">No hay una sesión activa para el día de hoy.</p>
      </div>
      <button
        onClick={() => setShowOpenModal(true)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 hover:bg-main-400 py-4 text-base font-bold text-white transition-all cursor-pointer shadow-lg shadow-main-500/20 active:scale-[0.98]"
      >
        <Plus size={20} />
        Abrir Caja de Hoy
      </button>

      {openModal}
    </div>
  )

  // ── Closed session summary ────────────────────────────────────────────────────
  if (isClosedToday) {
    const closedAt = session.closedAt?.toDate?.()?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) ?? '—'
    const theoreticalAtClose = (session.openingFloat || 0) + (session.cashSales || 0) + (session.deposits || []).reduce((s, d) => s + d.amount, 0) - (session.withdrawals || []).reduce((s, w) => s + w.amount, 0)
    const closedVariance = (session.closingCash ?? 0) - theoreticalAtClose
    
    return (
      <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
        <div className="bg-main-900/50 border border-white/5 rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="h-16 w-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Lock size={32} className="text-emerald-400" />
          </div>
          <div className="text-center sm:text-left flex-1">
            <p className="text-xl font-bold text-light-100">Caja cerrada hoy</p>
            <p className="text-sm text-light-200/40 mt-1 capitalize">{fmtDate(session.date)} · Finalizó a las {closedAt}</p>
          </div>
          <div className="text-center sm:text-right px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/5">
            <p className="text-[10px] text-light-200/30 uppercase font-bold tracking-tighter">Varianza Final</p>
            <p className={`text-2xl font-black tabular-nums mt-0.5 ${Math.abs(closedVariance) < 0.01 ? 'text-emerald-400' : closedVariance > 0 ? 'text-blue-400' : 'text-rose-400'}`}>
              {closedVariance >= 0 ? '+' : ''}{formatMoney(closedVariance)}
            </p>
          </div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-6 text-center">
          <p className="text-sm text-amber-200/70 mb-4">¿Necesitas re-abrir la caja para realizar ajustes?</p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/30 transition-all cursor-pointer"
          >
            <LogIn size={16} />
            Re-abrir Caja
          </button>
        </div>

        {openModal}
      </div>
    )
  }

  // ── Active session ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">

      {/* Balance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-main-900/50 border border-white/5 rounded-3xl p-6">
          <p className="text-xs font-medium text-light-200/40 uppercase tracking-wider">Fondo Inicial</p>
          <p className="text-3xl font-bold text-light-100 mt-2 tabular-nums">{formatMoney(session.openingFloat || 0)}</p>
        </div>
        <div className="bg-main-900/50 border border-white/5 rounded-3xl p-6">
          <p className="text-xs font-medium text-light-200/40 uppercase tracking-wider">Saldo Teórico en Caja</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2 tabular-nums">{formatMoney(theoreticalBalance)}</p>
        </div>
      </div>

      {/* Sales summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ventas Efectivo', val: session.cashSales || 0, icon: Banknote, color: 'text-emerald-400' },
          { label: 'Ventas Tarjeta',  val: session.cardSales || 0, icon: CreditCard, color: 'text-blue-400' },
          { label: 'Loyalty',         val: session.loyaltyRedemptions || 0, icon: Wallet, color: 'text-amber-400' },
        ].map(({ label, val, icon: Icon, color }) => (
          <div key={label} className="bg-main-900/30 border border-white/5 rounded-2xl p-4">
            <Icon size={16} className={`${color} mb-2`} />
            <p className="text-xs text-light-200/40 leading-tight">{label}</p>
            <p className={`text-lg font-bold tabular-nums mt-1 ${color}`}>{formatMoney(val)}</p>
          </div>
        ))}
      </div>

      {/* Deposits / Withdrawals / Close actions */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => toggleAction('deposit')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-semibold transition-all cursor-pointer min-w-[120px] ${
              activeAction === 'deposit'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-main-900/30 border-white/5 text-light-200/60 hover:border-white/10 hover:text-light-100'
            }`}
          >
            <ArrowDownCircle size={17} />
            Depositar
          </button>
          <button
            onClick={() => toggleAction('withdraw')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-semibold transition-all cursor-pointer min-w-[120px] ${
              activeAction === 'withdraw'
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-main-900/30 border-white/5 text-light-200/60 hover:border-white/10 hover:text-light-100'
            }`}
          >
            <ArrowUpCircle size={17} />
            Retirar
          </button>
          <button
            onClick={() => toggleAction('close')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-semibold transition-all cursor-pointer min-w-[120px] ${
              activeAction === 'close'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-main-900/30 border-white/5 text-light-200/60 hover:border-white/10 hover:text-light-100'
            }`}
          >
            <Lock size={17} />
            Cerrar Caja
          </button>
        </div>

        {/* Deposit / Withdraw inline form */}
        {(activeAction === 'deposit' || activeAction === 'withdraw') && (
          <div
            className={`rounded-2xl border p-4 space-y-3 ${
              activeAction === 'deposit'
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-rose-500/5 border-rose-500/20'
            }`}
            onKeyDown={e => { if (e.key === 'Enter' && actionAmount > 0 && !isSubmitting) { e.preventDefault(); submitAction() } }}
          >
            <p className="text-sm font-semibold text-light-200/70">
              {activeAction === 'deposit' ? 'Registrar Depósito' : 'Registrar Retiro'}
            </p>
            <div className="flex gap-3">
              <MoneyInput
                value={actionAmount}
                onChange={setActionAmount}
                autoFocus
                inputClassName={`rounded-xl border py-2.5 text-base text-light-200 outline-none transition ${
                  activeAction === 'deposit'
                    ? 'border-emerald-500/30 bg-main-900/60 focus:border-emerald-500/50'
                    : 'border-rose-500/30 bg-main-900/60 focus:border-rose-500/50'
                }`}
                className="flex-none w-36"
              />
              <input
                type="text"
                placeholder="Descripción (opcional)"
                value={actionDesc}
                onChange={e => setActionDesc(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-main-900/60 px-3 py-2.5 text-sm text-light-200 placeholder:text-light-200/25 outline-none focus:border-white/20 transition"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setActiveAction(null)} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-light-200/40 hover:bg-white/5 transition cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={submitAction}
                disabled={!actionAmount || actionAmount <= 0 || isSubmitting}
                className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeAction === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-700 hover:bg-rose-600'
                }`}
              >
                {isSubmitting ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {/* Close register inline form */}
        {activeAction === 'close' && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
            <p className="text-sm font-semibold text-amber-200">Cierre de Caja</p>

            {/* Summary table */}
            <div className="rounded-xl border border-white/5 bg-main-950 p-4 space-y-2 text-sm">
              {[
                ['Fondo inicial',     formatMoney(session.openingFloat || 0), ''],
                ['+ Ventas efectivo', formatMoney(session.cashSales || 0),    'text-emerald-400'],
                ['+ Ventas tarjeta',  formatMoney(session.cardSales || 0),    'text-blue-400'],
                ['+ Depósitos',       formatMoney(totalDeposits),             'text-emerald-400/70'],
                ['− Retiros',         formatMoney(totalWithdrawals),          'text-rose-400'],
              ].map(([label, val, cls]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-light-200/40">{label}</span>
                  <span className={cls || 'text-light-200/70'}>{val}</span>
                </div>
              ))}
              <div className="border-t border-white/5 pt-2 flex justify-between font-semibold">
                <span className="text-light-200/60">Efectivo esperado</span>
                <span className="text-light-100">{formatMoney(theoreticalBalance)}</span>
              </div>
            </div>

            {/* Closing cash input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-light-200/40 uppercase tracking-wider">Efectivo contado físicamente</label>
              <MoneyInput
                value={closingCash}
                onChange={setClosingCash}
                autoFocus
                inputClassName="rounded-2xl border border-white/10 bg-main-950 py-3 text-xl text-center text-light-200 outline-none focus:border-amber-500/40 transition"
              />
              {closingCash > 0 && (
                <div className={`flex items-center gap-2 text-sm font-bold px-3 py-2 rounded-xl ${
                  Math.abs(variance) < 0.01
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : variance > 0
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {Math.abs(variance) < 0.01
                    ? <><CheckCircle2 size={15} /> Cuadra perfectamente</>
                    : variance > 0
                    ? <><AlertTriangle size={15} /> Sobrante: +{formatMoney(variance)}</>
                    : <><AlertTriangle size={15} /> Faltante: {formatMoney(variance)}</>
                  }
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setActiveAction(null)} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-light-200/40 hover:bg-white/5 transition cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={handleCloseRegister}
                disabled={isSubmitting}
                className="flex-1 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-bold text-white transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Cerrando…' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction log */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-light-200/50 uppercase tracking-wider px-2">Movimientos de hoy</h2>
          <div className="bg-main-900/30 border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5 shadow-xl">
            {transactions.map((tx, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                  tx.type === 'deposit'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {tx.type === 'deposit' ? <ArrowDownCircle size={15} /> : <ArrowUpCircle size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-light-100 truncate">{tx.description}</p>
                  <p className="text-xs text-light-200/35 flex items-center gap-1 mt-0.5">
                    <Clock size={10} /> {fmtTime(tx.ts)}
                  </p>
                </div>
                <span className={`text-sm font-bold tabular-nums shrink-0 ${tx.type === 'deposit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.type === 'deposit' ? '+' : '-'}{formatMoney(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
