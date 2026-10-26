/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { RefreshCw, GripVertical, ArrowLeft } from 'lucide-react'
import { db } from '../../firebase'
import { useStationContext } from '../../context/StationContext'
import { deriveGroupStatus, isOrderFullyDone } from '../../utils/stations'
import { ACTIVE_STATUSES } from '../../utils/orderStatus'

const COLUMNS = [
  { key: 'pending', label: 'Pendiente' },
  { key: 'preparando', label: 'En preparación' },
  { key: 'listo', label: 'Listo' },
]

const NEXT_STATUS = { pending: 'preparando', preparando: 'listo', listo: 'listo' }
const PREV_STATUS = { pending: 'pending', preparando: 'pending', listo: 'preparando' }

const ItemCard = ({ order, item, onAdvance, onReturn }) => {
  const optionsText = (item.selectedOptions || []).map((o) => o.optionName).filter(Boolean).join(', ')
  const toppingsText = (item.selectedToppings || []).map((t) => t.name).filter(Boolean).join(', ')

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ orderId: order.id, lineId: item._lineId }))
      }}
      onClick={() => onAdvance(order, item)}
      className="rounded-2xl border border-white/10 bg-main-900 p-4 cursor-pointer active:scale-[0.98] transition-transform select-none"
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-light-200/45 shrink-0 mt-1 cursor-grab" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-light-200/65">#{(order.orderId || order.id).slice(-6)}</p>
          <p className="text-xl font-bold text-light-100 leading-snug mt-0.5">
            {item.qty > 1 && <span className="text-main-400">{item.qty}× </span>}
            {item.name}
          </p>
          {(optionsText || toppingsText) && (
            <p className="text-sm text-light-200/70 mt-1">{[optionsText, toppingsText].filter(Boolean).join(' · ')}</p>
          )}
          {item.itemNote && (
            <p className="mt-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1 inline-block">
              {item.itemNote}
            </p>
          )}
        </div>
      </div>
      {item.itemStatus !== 'pending' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReturn(order, item) }}
          className="mt-3 flex items-center gap-1.5 text-xs text-light-200/65 hover:text-light-100 transition-colors cursor-pointer"
        >
          <ArrowLeft size={12} /> Regresar
        </button>
      )}
    </div>
  )
}

export const KitchenBoard = () => {
  const { selectedStation, clearStation } = useStationContext()
  const [now, setNow] = useState(new Date())
  const [orders, setOrders] = useState([])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedStation) return
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (!alive) return
      // Only orders still being made (it used to read the OLDEST 60 orders,
      // which only worked while the menu capped `orders` at 50).
      const q = query(collection(db, 'orders'), where('status', 'in', ACTIVE_STATUSES))
      unsub = onSnapshot(
        q,
        (snap) => {
          if (!alive) return
          const filtered = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((o) =>
              o.sentToKitchen === true &&
              o.status !== 'Pagado' && o.status !== 'Reembolsado' && o.status !== 'Cancelado' &&
              (o.stationItems?.[selectedStation.id]?.items?.length || 0) > 0
            )
            .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
          setOrders(filtered)
        },
        (error) => {
          console.error('Error listening to kitchen orders:', error)
          if (alive) setOrders([])
        }
      )
    }, 0)
    return () => {
      alive = false
      clearTimeout(timer)
      if (unsub) try { unsub() } catch {}
    }
  }, [selectedStation])

  const moveItem = useCallback(async (order, lineId, newStatus) => {
    const stationId = selectedStation.id
    const group = order.stationItems?.[stationId]
    if (!group) return

    const nextItems = group.items.map((it) => it._lineId === lineId ? { ...it, itemStatus: newStatus } : it)
    const nextStationItems = {
      ...order.stationItems,
      [stationId]: { items: nextItems, status: deriveGroupStatus(nextItems) },
    }

    // Optimistic local update so the board feels instant.
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, stationItems: nextStationItems } : o))

    const updatedOrder = { ...order, stationItems: nextStationItems }
    const payload = { stationItems: nextStationItems, updatedAt: serverTimestamp() }
    if (isOrderFullyDone(updatedOrder)) payload.status = 'Listo'

    try {
      await updateDoc(doc(db, 'orders', order.id), payload)
    } catch (error) {
      console.error('Error moving kitchen item:', error)
    }
  }, [selectedStation])

  const handleAdvance = (order, item) => {
    const next = NEXT_STATUS[item.itemStatus] || 'pending'
    if (next === item.itemStatus) return
    moveItem(order, item._lineId, next)
  }

  const handleReturn = (order, item) => {
    moveItem(order, item._lineId, PREV_STATUS[item.itemStatus] || 'pending')
  }

  const handleDrop = (e, columnKey) => {
    e.preventDefault()
    try {
      const { orderId, lineId } = JSON.parse(e.dataTransfer.getData('text/plain'))
      const order = orders.find((o) => o.id === orderId)
      if (order) moveItem(order, lineId, columnKey)
    } catch {}
  }

  const stationId = selectedStation?.id
  const columnItems = (columnKey) => orders.flatMap((order) =>
    (order.stationItems?.[stationId]?.items || [])
      .filter((item) => item.itemStatus === columnKey)
      .map((item) => ({ order, item }))
  )

  return (
    <div className="min-h-dvh bg-main-950 text-light-100 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{selectedStation?.name || 'Cocina'}</h1>
          <p className="text-xs text-light-200/65 mt-1 tabular-nums">
            {now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            En línea
          </div>
          <button
            type="button"
            onClick={clearStation}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 text-sm text-light-200/60 hover:text-light-100 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <RefreshCw size={15} />
            Cambiar estación
          </button>
        </div>
      </header>

      {orders.length === 0 ? (
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-2xl">Todo al día 🎉</p>
            <p className="text-sm text-light-200/65">Esperando nuevos pedidos</p>
          </div>
        </main>
      ) : (
        <main className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/5 overflow-hidden">
          {COLUMNS.map((column) => {
            const items = columnItems(column.key)
            return (
              <div
                key={column.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, column.key)}
                className="flex flex-col bg-main-950 min-h-0 overflow-hidden"
              >
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <p className="font-semibold text-light-100">{column.label}</p>
                  <span className="h-6 min-w-[24px] px-1.5 rounded-full bg-white/5 text-xs font-bold text-light-200/60 flex items-center justify-center">
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {items.map(({ order, item }) => (
                    <ItemCard
                      key={`${order.id}-${item._lineId}`}
                      order={order}
                      item={item}
                      onAdvance={handleAdvance}
                      onReturn={handleReturn}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </main>
      )}
    </div>
  )
}
