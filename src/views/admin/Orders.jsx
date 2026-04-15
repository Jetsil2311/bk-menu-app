import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { Clock, CheckCircle2, Package, RefreshCcw, Search, ChevronDown, X } from 'lucide-react'

const STATUSES = ['Nuevo', 'En preparación', 'Listo', 'Entregado']

const STATUS_COLORS = {
  nuevo: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'en preparación': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  listo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  entregado: 'bg-light-200/5 text-light-200/30 border-light-200/10',
}

const getStatusColor = (status) =>
  STATUS_COLORS[status?.toLowerCase()] ?? 'bg-amber-500/10 text-amber-400 border-amber-500/20'

const nextStatus = (current) => {
  const idx = STATUSES.findIndex(s => s.toLowerCase() === current?.toLowerCase())
  if (idx === -1 || idx === STATUSES.length - 1) return null
  return STATUSES[idx + 1]
}

// Parses item lines from the order content string.
// Format: "1. 1 x ProductName (option) [toppings] - $XX.00"
const parseOrderContent = (content = '') => {
  const lines = content.split('\n')
  const items = lines
    .filter(l => /^\d+\./.test(l.trim()))
    .map(l => l.replace(/^\d+\.\s*/, '').trim())
  const total = lines.find(l => l.startsWith('Total:'))?.replace('Total:', '').trim() ?? null
  const notes = lines.find(l => l.startsWith('Notas:'))?.replace('Notas:', '').trim() ?? null
  return { items, total, notes }
}

const formatRelativeTime = (date) => {
  if (!date) return '—'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH} h`
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export const Orders = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
      }))
      setOrders(data)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const updateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId)
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus })
    } catch (err) {
      console.error('Error updating status:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  // Filter
  const filtered = orders.filter(o => {
    const statusMatch =
      filterStatus === 'Todos' ||
      (o.status || 'Nuevo').toLowerCase() === filterStatus.toLowerCase()
    const searchMatch =
      !search ||
      (o.orderId ?? o.id).toLowerCase().includes(search.toLowerCase()) ||
      (o.content ?? '').toLowerCase().includes(search.toLowerCase())
    return statusMatch && searchMatch
  })

  // Today count
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = orders.filter(o => o.createdAt >= todayStart).length

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-light-100">Pedidos</h2>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-main-900/40 border border-white/5 rounded-xl text-xs font-medium text-light-200/60">
          <Clock size={14} />
          Hoy: {todayCount} pedidos
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        {/* Status filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-main-900/30 border border-white/5">
          {['Todos', ...STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-main-500 text-white'
                  : 'text-light-200/50 hover:text-light-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/30" />
          <input
            type="text"
            placeholder="Buscar por ID o contenido..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/8 bg-main-900/30 pl-8 pr-9 py-2 text-sm text-light-100 placeholder-light-200/30 outline-none transition focus:border-main-500/40"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-light-200/30 hover:text-light-100">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="p-20 text-center">
          <RefreshCcw size={32} className="mx-auto text-main-500 animate-spin mb-4" />
          <p className="text-light-200/40">Cargando pedidos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-main-900/20 border border-white/5 rounded-3xl p-20 text-center">
          <Package size={48} className="mx-auto text-light-200/10 mb-4" />
          <p className="text-light-200/40 italic">
            {orders.length === 0 ? 'Aún no hay pedidos.' : 'No hay pedidos con este filtro.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((order) => {
            const shortId = order.orderId
              ? order.orderId.slice(-6)
              : order.id.slice(-4).toUpperCase()
            const next = nextStatus(order.status || 'Nuevo')
            const isExpanded = expandedId === order.id
            const parsed = parseOrderContent(order.content)
            const timeAgo = formatRelativeTime(order.createdAt)
            const timeAbsolute = order.createdAt instanceof Date
              ? order.createdAt.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : '—'

            return (
              <div key={order.id} className="bg-main-900/30 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
                {/* Main row */}
                <div className="p-4 flex flex-wrap items-center gap-4">
                  {/* ID badge */}
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-main-800 flex items-center justify-center text-main-400 font-bold text-xs border border-white/5">
                    #{shortId}
                  </div>

                  {/* Status + time */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                        {order.status || 'Nuevo'}
                      </span>
                      <span
                        className="text-xs text-light-200/40 cursor-default"
                        title={timeAbsolute}
                      >
                        {timeAgo}
                      </span>
                    </div>
                    {/* Item preview */}
                    <p className="text-xs text-light-200/50 mt-0.5 truncate max-w-[220px]">
                      {parsed.items.length > 0
                        ? parsed.items.slice(0, 2).join(' · ') + (parsed.items.length > 2 ? ` +${parsed.items.length - 2}` : '')
                        : '—'}
                    </p>
                  </div>

                  {/* Total */}
                  <span className="ml-auto font-bold text-light-100">
                    ${Number(order.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {next && (
                      <button
                        onClick={() => updateStatus(order.id, next)}
                        disabled={updatingId === order.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-main-500 hover:bg-main-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-main-500/10 disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        {next}
                      </button>
                    )}
                    {order.status?.toLowerCase() === 'entregado' && (
                      <span className="px-3 py-2 text-xs font-medium text-light-200/20 flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Completado
                      </span>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="p-2 rounded-xl bg-white/5 text-light-200/40 hover:text-light-100 hover:bg-white/10 transition-colors"
                      title="Ver detalle"
                    >
                      <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-white/5 px-4 py-4 bg-main-950/30">
                    <p className="text-xs font-semibold text-light-200/40 uppercase tracking-wider mb-3">
                      Detalle del pedido
                    </p>
                    {parsed.items.length > 0 ? (
                      <ul className="space-y-1.5 mb-3">
                        {parsed.items.map((line, i) => (
                          <li key={i} className="text-sm text-light-200/80">{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-light-200/30 italic mb-3 whitespace-pre-line">{order.content || 'Sin detalle.'}</p>
                    )}
                    {parsed.notes && (
                      <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/80">
                        <span className="font-semibold">Notas:</span> {parsed.notes}
                      </div>
                    )}
                    {/* Status progression */}
                    <div className="mt-4 flex items-center gap-1">
                      {STATUSES.map((s, i) => {
                        const currentIdx = STATUSES.findIndex(x => x.toLowerCase() === (order.status || 'nuevo').toLowerCase())
                        const isDone = i <= currentIdx
                        return (
                          <div key={s} className="flex items-center gap-1 flex-1">
                            <button
                              onClick={() => updateStatus(order.id, s)}
                              disabled={updatingId === order.id}
                              className={`flex-1 text-[10px] font-semibold py-1 rounded-lg text-center transition-colors ${isDone ? 'bg-main-500 text-white' : 'bg-white/5 text-light-200/30 hover:bg-white/10'}`}
                            >
                              {s}
                            </button>
                            {i < STATUSES.length - 1 && <div className={`w-2 h-px ${isDone ? 'bg-main-500' : 'bg-white/10'}`} />}
                          </div>
                        )
                      })}
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
