import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { formatMoney } from '../../utils/cart'
import {
  Clock, CheckCircle2, Package, RefreshCcw,
  Search, ChevronDown, X, ArrowRight,
} from 'lucide-react'

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

// Active first (Nuevo→Preparando→Listo→Pagado), oldest-first within each group
const sortOrders = (orders) =>
  [...orders].sort((a, b) => {
    const pa = STATUS_PRIORITY[normalizeStatus(a.status).toLowerCase()] ?? 0
    const pb = STATUS_PRIORITY[normalizeStatus(b.status).toLowerCase()] ?? 0
    if (pa !== pb) return pa - pb
    return (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0)
  })

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

// ─── Orders view ───────────────────────────────────────────────────────────────

export const Orders = () => {
  const [orders, setOrders]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [filterStatus, setFilterStatus] = useState('Activos')
  const [search, setSearch]         = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  // Persistent real-time listener — closes on unmount
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        status: normalizeStatus(d.data().status),
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      }))
      setOrders(data)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

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
        ? o.status.toLowerCase() !== 'pagado'
        : o.status.toLowerCase() === filterStatus.toLowerCase()
    const searchMatch =
      !search ||
      (o.orderId ?? o.id).toLowerCase().includes(search.toLowerCase()) ||
      (o.customerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.content ?? '').toLowerCase().includes(search.toLowerCase())
    return statusMatch && searchMatch
  })

  const sorted = sortOrders(filtered)

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
      <div className="flex flex-wrap gap-3">
        <div
          className="flex items-center gap-1 p-1 rounded-xl bg-main-900/30 border border-white/5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {['Activos', ...STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filterStatus === s
                  ? 'bg-main-500 text-white'
                  : 'text-light-200/50 hover:text-light-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/30" />
          <input
            type="text"
            placeholder="Buscar por ID, cliente o contenido..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/8 bg-main-900/30 pl-8 pr-9 py-2 text-sm text-light-100 placeholder-light-200/30 outline-none transition focus:border-main-500/40"
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

            return (
              <div
                key={order.id}
                className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isPagado
                    ? 'bg-main-950/20 border-white/[0.03] opacity-70 hover:opacity-90 hover:border-white/5'
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
                    {actionLabel ? (
                      <button
                        onClick={() => updateStatus(order.id, next)}
                        disabled={isUpdating}
                        className="flex items-center gap-1.5 px-3 py-2 bg-main-500 hover:bg-main-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-main-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        {actionLabel}
                      </button>
                    ) : isPagado ? (
                      <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-light-200/25">
                        <CheckCircle2 size={14} />
                        Completado
                      </span>
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
