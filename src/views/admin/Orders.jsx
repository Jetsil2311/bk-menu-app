import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, increment,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { formatMoney } from '../../utils/cart'
import { useSettings } from '../../hooks/useSettings'
import { printReceipt } from '../../utils/printReceipt'
import {
  Clock, CheckCircle2, Package, RefreshCcw,
  Search, ChevronDown, X, ArrowRight, ArrowUpDown, Printer, Undo2,
} from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────────────────────────

const todayKey = () => {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUSES = ['Nuevo', 'Preparando', 'Listo', 'Pagado']

const STATUS_PRIORITY = { nuevo: 0, preparando: 1, listo: 2, pagado: 3 }

// Includes legacy aliases for backwards-compatibility with orders saved before this update
const STATUS_COLORS = {
  nuevo:            'bg-amber-500/10 text-amber-400 border-amber-500/20',
  preparando:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'en preparación': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  listo:            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pagado:           'bg-light-200/5 text-light-200/30 border-light-200/10',
  entregado:        'bg-light-200/5 text-light-200/30 border-light-200/10',
  reembolsado:      'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

const ACTION_LABELS = {
  Preparando: 'Iniciar preparación',
  Listo:      'Marcar como listo',
  Pagado:     'Registrar pago',
}

const getStatusColor = (status) =>
  STATUS_COLORS[status?.toLowerCase()] ?? 'bg-amber-500/10 text-amber-400 border-amber-500/20'

// Migrate legacy status names to the new canonical set
const normalizeStatus = (raw) => {
  if (!raw) return 'Nuevo'
  const lower = raw.toLowerCase()
  if (lower === 'en preparación' || lower === 'en preparacion') return 'Preparando'
  if (lower === 'entregado') return 'Pagado'
  return raw
}

const nextStatus = (current) => {
  const norm = normalizeStatus(current)
  const idx = STATUSES.findIndex(s => s.toLowerCase() === norm.toLowerCase())
  if (idx === -1 || idx === STATUSES.length - 1) return null
  return STATUSES[idx + 1]
}

// Sort options shown in the dropdown
const SORT_OPTIONS = [
  { key: 'newest',      label: 'Más reciente'  },
  { key: 'oldest',      label: 'Más antiguo'   },
  { key: 'paid_recent', label: 'Recién pagado' },
]

// Smart default: Pagado filter → by paid time; all others → by created time (newest)
const defaultSortFor = (filter) => filter === 'Pagado' ? 'paid_recent' : 'newest'

const applySort = (orders, mode) => {
  const arr = [...orders]
  if (mode === 'paid_recent') {
    return arr.sort((a, b) => {
      const ta = (a.updatedAt ?? a.createdAt)?.getTime?.() ?? 0
      const tb = (b.updatedAt ?? b.createdAt)?.getTime?.() ?? 0
      return tb - ta
    })
  }
  if (mode === 'oldest') {
    return arr.sort((a, b) =>
      (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0)
    )
  }
  // newest (default for non-pagados)
  return arr.sort((a, b) =>
    (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0)
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatRelativeTime = (date) => {
  if (!date) return '—'
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH} h`
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

const itemLineTotal = (it) =>
  (Number(it.price || 0)
    + (it.selectedOptions || []).reduce((s, o) => s + Number(o.priceModifier || 0), 0)
    + (it.selectedToppings || []).reduce((s, t) => s + Number(t.price || 0), 0)
  ) * (it.qty || 1)

// Returns React nodes for the item list (prefers items array, falls back to content string)
const renderItemList = (order) => {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.map((it, i) => {
      const optTxt = it.selectedOptions?.length
        ? ` · ${it.selectedOptions.map(o => o.optionName).join(', ')}`
        : ''
      const topTxt = it.selectedToppings?.length
        ? ` · ${it.selectedToppings.map(t => t.name).join(', ')}`
        : ''
      const noteTxt = it.itemNote ? ` (${it.itemNote})` : ''
      return (
        <li key={i} className="flex items-baseline justify-between gap-3 text-sm text-light-200/80">
          <span className="truncate">
            {it.qty}× <span className="font-medium">{it.name}</span>
            <span className="text-light-200/40 text-xs">{optTxt}{topTxt}{noteTxt}</span>
          </span>
          <span className="text-light-200/40 tabular-nums text-xs shrink-0">
            {formatMoney(itemLineTotal(it))}
          </span>
        </li>
      )
    })
  }
  // Fallback: parse legacy content string
  const lines = (order.content || '').split('\n')
  const items = lines
    .filter(l => /^\d+\./.test(l.trim()))
    .map(l => l.replace(/^\d+\.\s*/, '').trim())
  if (items.length === 0) {
    return [<li key="raw" className="text-sm text-light-200/30 italic">{order.content || 'Sin detalle.'}</li>]
  }
  return items.map((line, i) => (
    <li key={i} className="text-sm text-light-200/80">{line}</li>
  ))
}

const getItemPreview = (order) => {
  if (Array.isArray(order.items) && order.items.length > 0) {
    const names = order.items.map(it => `${it.qty > 1 ? `${it.qty}× ` : ''}${it.name}`)
    return names.slice(0, 2).join(' · ') + (names.length > 2 ? ` +${names.length - 2}` : '')
  }
  const lines = (order.content || '').split('\n')
  const items = lines
    .filter(l => /^\d+\./.test(l.trim()))
    .map(l => l.replace(/^\d+\.\s*/, '').trim())
  return items.slice(0, 2).join(' · ') + (items.length > 2 ? ` +${items.length - 2}` : '') || '—'
}

const getOrderNote = (order) => {
  if (order.generalNote) return order.generalNote
  const noteLine = (order.content || '').split('\n').find(l => l.startsWith('Notas:'))
  return noteLine?.replace('Notas:', '').trim() ?? null
}

// ─── RefundModal ──────────────────────────────────────────────────────────────

const RefundModal = ({ order, onClose, onConfirm, isProcessing }) => {
  const cashRefund = Math.max(0,
    Number(order.total || 0)
    - (order.paymentMethods?.card    || 0)
    - (order.paymentMethods?.loyalty || 0)
  )
  const cardRefund    = order.paymentMethods?.card    || 0
  const loyaltyRefund = order.paymentMethods?.loyalty || 0
  const shortId = order.orderId ? order.orderId.slice(-6) : order.id.slice(-4).toUpperCase()

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-main-900 border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center shrink-0">
              <Undo2 size={16} className="text-rose-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-light-100">Confirmar reembolso</h3>
              <p className="text-xs text-light-200/40 mt-0.5">Orden #{shortId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-light-200/50 cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Amount breakdown */}
        <div className="rounded-2xl border border-white/5 bg-main-950/60 divide-y divide-white/5 overflow-hidden">
          {cashRefund > 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-light-200/60 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                Efectivo
              </span>
              <span className="text-sm font-bold text-rose-400 tabular-nums">-{formatMoney(cashRefund)}</span>
            </div>
          )}
          {cardRefund > 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-light-200/60 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                Tarjeta
              </span>
              <span className="text-sm font-bold text-rose-400 tabular-nums">-{formatMoney(cardRefund)}</span>
            </div>
          )}
          {loyaltyRefund > 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-light-200/60 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                Loyalty
              </span>
              <span className="text-sm font-bold text-rose-400 tabular-nums">-{formatMoney(loyaltyRefund)}</span>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 bg-white/2">
            <span className="text-sm font-semibold text-light-200/70">Total reembolsado</span>
            <span className="text-base font-bold text-light-100 tabular-nums">-{formatMoney(Number(order.total || 0))}</span>
          </div>
        </div>

        <p className="text-xs text-light-200/30 text-center">
          Estos montos se descontarán de las ventas de caja del día de hoy.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-white/10 text-sm font-semibold text-light-200/50 hover:bg-white/5 hover:text-light-100 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-2xl bg-rose-700 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-white transition cursor-pointer"
          >
            {isProcessing ? 'Procesando…' : 'Confirmar reembolso'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Orders view ───────────────────────────────────────────────────────────────

export const Orders = () => {
  const [orders, setOrders]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [filterStatus, setFilterStatus] = useState('Activos')
  const [search, setSearch]         = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [sortMode, setSortMode]     = useState(null)  // null = smart default
  const [sortOpen, setSortOpen]     = useState(false)
  const [printingId, setPrintingId] = useState(null)
  const [refundTarget, setRefundTarget] = useState(null)
  const [isRefunding, setIsRefunding]   = useState(false)
  const { settings } = useSettings()

  // Persistent real-time listener — closes on unmount
  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (cancelled) return
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      unsub = onSnapshot(q, (snapshot) => {
        if (!alive) return
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          status: normalizeStatus(d.data().status),
          createdAt: d.data().createdAt?.toDate() ?? new Date(),
          updatedAt: d.data().updatedAt?.toDate() ?? null,
        }))
        setOrders(data)
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

  // Reset to smart default sort whenever the active filter changes
  useEffect(() => {
    setSortMode(null)
    setSortOpen(false)
  }, [filterStatus])

  const handleReprint = async (order) => {
    setPrintingId(order.id)
    await printReceipt(order, settings)
    setPrintingId(null)
  }

  const handleRefund = async () => {
    if (!refundTarget || isRefunding) return
    setIsRefunding(true)
    try {
      const cashRefund = Math.max(0,
        Number(refundTarget.total || 0)
        - (refundTarget.paymentMethods?.card    || 0)
        - (refundTarget.paymentMethods?.loyalty || 0)
      )
      const cardRefund    = refundTarget.paymentMethods?.card    || 0
      const loyaltyRefund = refundTarget.paymentMethods?.loyalty || 0

      await updateDoc(doc(db, 'orders', refundTarget.id), {
        status: 'Reembolsado',
        refundedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      const registerUpdates = { updatedAt: serverTimestamp() }
      if (cashRefund    > 0) registerUpdates.cashSales          = increment(-cashRefund)
      if (cardRefund    > 0) registerUpdates.cardSales          = increment(-cardRefund)
      if (loyaltyRefund > 0) registerUpdates.loyaltyRedemptions = increment(-loyaltyRefund)

      if (Object.keys(registerUpdates).length > 1) {
        await updateDoc(doc(db, 'register_sessions', todayKey()), registerUpdates)
      }

      setRefundTarget(null)
    } catch (err) {
      console.error('Refund error:', err)
    } finally {
      setIsRefunding(false)
    }
  }

  const updateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId)
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('Error updating order status:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount  = orders.filter(o => o.createdAt >= todayStart).length
  const activeCount = orders.filter(o =>
    ['nuevo', 'preparando', 'listo'].includes((o.status || '').toLowerCase()) &&
    o.createdAt >= todayStart
  ).length

  const filtered = orders.filter(o => {
    const statusMatch =
      filterStatus === 'Activos'
        ? !['pagado', 'reembolsado'].includes(o.status.toLowerCase())
        : o.status.toLowerCase() === filterStatus.toLowerCase()
    const searchMatch =
      !search ||
      (o.orderId ?? o.id).toLowerCase().includes(search.toLowerCase()) ||
      (o.customerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.content ?? '').toLowerCase().includes(search.toLowerCase())
    return statusMatch && searchMatch
  })

  const effectiveSort = sortMode ?? defaultSortFor(filterStatus)
  const sorted = applySort(filtered, effectiveSort)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-light-100">Pedidos</h2>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-semibold text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {activeCount} activo{activeCount !== 1 ? 's' : ''}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-main-900/40 border border-white/5 rounded-xl text-xs font-medium text-light-200/60">
            <Clock size={14} />
            Hoy: {todayCount} pedidos
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search — full width on mobile */}
        <div className="relative flex-1 min-w-0 md:min-w-[200px] order-first md:order-last">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/30" />
          <input
            type="text"
            placeholder="Buscar por ID, cliente o contenido..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/8 bg-main-900/30 pl-8 pr-9 py-2.5 md:py-2 text-sm text-light-100 placeholder-light-200/30 outline-none transition focus:border-main-500/40 min-h-11"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-light-200/30 hover:text-light-100 cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status pills + sort button */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-1 p-1 rounded-xl bg-main-900/30 border border-white/5 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {['Activos', ...STATUSES, 'Reembolsado'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer min-h-9 ${
                  filterStatus === s
                    ? 'bg-main-500 text-white'
                    : 'text-light-200/50 hover:text-light-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setSortOpen(v => !v)}
              title={`Ordenar: ${SORT_OPTIONS.find(o => o.key === effectiveSort)?.label}`}
              className={`flex items-center gap-1.5 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer min-h-11 ${
                sortMode !== null
                  ? 'bg-main-500/20 border-main-500/40 text-main-300'
                  : 'bg-main-900/30 border-white/5 hover:border-white/10 text-light-200/50 hover:text-light-100'
              }`}
            >
              <ArrowUpDown size={13} />
              <span className="hidden sm:inline whitespace-nowrap">
                {SORT_OPTIONS.find(o => o.key === effectiveSort)?.label}
              </span>
            </button>

            {sortOpen && (
              <>
                <div className="fixed inset-0 z-5" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-10 bg-main-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl min-w-40">
                  {(filterStatus === 'Pagado' ? SORT_OPTIONS : SORT_OPTIONS.filter(o => o.key !== 'paid_recent')).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortMode(opt.key); setSortOpen(false) }}
                      className={`w-full text-left px-4 py-3 text-xs font-medium transition-colors cursor-pointer ${
                        effectiveSort === opt.key
                          ? 'bg-main-500/20 text-main-300'
                          : 'text-light-200/50 hover:bg-white/5 hover:text-light-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-20 text-center">
          <RefreshCcw size={32} className="mx-auto text-main-500 animate-spin mb-4" />
          <p className="text-light-200/40">Cargando pedidos...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-main-900/20 border border-white/5 rounded-3xl p-20 text-center">
          <Package size={48} className="mx-auto text-light-200/10 mb-4" />
          <p className="text-light-200/40 italic">
            {orders.length === 0 ? 'Aún no hay pedidos.' : 'No hay pedidos con este filtro.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sorted.map((order) => {
            const isPagado   = order.status.toLowerCase() === 'pagado'
            const next       = nextStatus(order.status)
            const actionLabel = next ? ACTION_LABELS[next] ?? next : null
            const isExpanded = expandedId === order.id
            const isUpdating = updatingId === order.id
            const shortId    = order.orderId
              ? order.orderId.slice(-6)
              : order.id.slice(-4).toUpperCase()
            const timeAgo     = formatRelativeTime(order.createdAt)
            const timeTooltip = order.createdAt instanceof Date
              ? order.createdAt.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : '—'
            const itemPreview = getItemPreview(order)
            const orderNote   = getOrderNote(order)
            const currentIdx  = STATUSES.findIndex(s => s.toLowerCase() === order.status.toLowerCase())

            const isReembolsado = order.status.toLowerCase() === 'reembolsado'

            return (
              <div
                key={order.id}
                className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isReembolsado
                    ? 'bg-rose-950/10 border-rose-500/10 opacity-70 hover:opacity-90 hover:border-rose-500/20'
                    : isPagado
                    ? 'bg-main-950/20 border-white/3 opacity-70 hover:opacity-90 hover:border-white/5'
                    : 'bg-main-900/30 border-white/5 hover:border-white/10'
                }`}
              >
                {/* Card header row */}
                <div className="p-4 flex flex-wrap items-center gap-4">

                  {/* ID badge */}
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-main-800 flex items-center justify-center text-main-400 font-bold text-xs border border-white/5 select-none">
                    #{shortId}
                  </div>

                  {/* Status + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                      {order.customerName && (
                        <span className="text-xs font-medium text-light-200/50 truncate max-w-[120px]">
                          {order.customerName}
                        </span>
                      )}
                      <span className="text-xs text-light-200/40 cursor-default" title={timeTooltip}>
                        {timeAgo}
                      </span>
                    </div>
                    <p className="text-xs text-light-200/40 mt-0.5 truncate max-w-[280px]">
                      {itemPreview}
                    </p>
                  </div>

                  {/* Total */}
                  <span className="font-bold text-light-100 tabular-nums shrink-0">
                    {formatMoney(Number(order.total || 0))}
                  </span>

                  {/* Action + expand */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isReembolsado ? (
                      <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400/60">
                        <Undo2 size={13} />
                        Reembolsado
                      </span>
                    ) : actionLabel ? (
                      <button
                        onClick={() => updateStatus(order.id, next)}
                        disabled={isUpdating}
                        className="flex items-center gap-1.5 px-3 py-2 bg-main-500 hover:bg-main-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-main-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        {actionLabel}
                      </button>
                    ) : isPagado ? (
                      <>
                        <button
                          onClick={() => setRefundTarget(order)}
                          title="Reembolsar pedido"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                        >
                          <Undo2 size={13} />
                          <span className="hidden sm:inline">Reembolsar</span>
                        </button>
                        <button
                          onClick={() => handleReprint(order)}
                          disabled={printingId === order.id}
                          title="Reimprimir ticket"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-xs font-medium text-light-200/40 hover:text-light-100 hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          <Printer size={13} />
                          <span className="hidden sm:inline">
                            {printingId === order.id ? 'Imprimiendo…' : 'Reimprimir'}
                          </span>
                        </button>
                      </>
                    ) : null}

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="p-2 rounded-xl bg-white/5 text-light-200/40 hover:text-light-100 hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Ver detalle"
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-white/5 px-4 py-4 bg-main-950/30 space-y-4">

                    {/* Items */}
                    <div>
                      <p className="text-xs font-semibold text-light-200/40 uppercase tracking-wider mb-2">
                        Productos
                      </p>
                      <ul className="space-y-2">
                        {renderItemList(order)}
                      </ul>
                    </div>

                    {/* Notes */}
                    {orderNote && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/80">
                        <span className="font-semibold">Notas:</span> {orderNote}
                      </div>
                    )}

                    {/* Payment breakdown */}
                    {order.paymentMethods && (
                      <div className="flex flex-wrap gap-3 text-xs text-light-200/40">
                        {order.paymentMethods.cash   > 0 && <span>Efectivo: {formatMoney(order.paymentMethods.cash)}</span>}
                        {order.paymentMethods.card   > 0 && <span>Tarjeta: {formatMoney(order.paymentMethods.card)}</span>}
                        {order.paymentMethods.loyalty > 0 && <span>Loyalty: {formatMoney(order.paymentMethods.loyalty)}</span>}
                      </div>
                    )}

                    {/* Read-only status stepper */}
                    {isReembolsado ? (
                      <div className="flex items-center gap-2 rounded-xl border border-rose-500/15 bg-rose-500/5 px-3 py-2.5 text-xs text-rose-300/70">
                        <Undo2 size={13} className="shrink-0" />
                        Esta orden fue reembolsada y descontada de caja
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-light-200/40 uppercase tracking-wider mb-2">
                          Progreso
                        </p>
                        <div className="flex items-center gap-1">
                          {STATUSES.map((s, i) => {
                            const isDone    = i <= currentIdx
                            const isCurrent = i === currentIdx
                            return (
                              <div key={s} className="flex items-center gap-1 flex-1">
                                <div
                                  className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg text-center select-none transition-colors ${
                                    isCurrent
                                      ? 'bg-main-500 text-white ring-1 ring-main-400/30'
                                      : isDone
                                      ? 'bg-main-700/50 text-main-300/60'
                                      : 'bg-white/5 text-light-200/20'
                                  }`}
                                >
                                  {s}
                                </div>
                                {i < STATUSES.length - 1 && (
                                  <ArrowRight
                                    size={10}
                                    className={isDone ? 'text-main-500/50 shrink-0' : 'text-white/10 shrink-0'}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {refundTarget && (
        <RefundModal
          order={refundTarget}
          onClose={() => setRefundTarget(null)}
          onConfirm={handleRefund}
          isProcessing={isRefunding}
        />
      )}
    </div>
  )
}
