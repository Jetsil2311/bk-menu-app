import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertTriangle, BellRing, Download, MessageCircle, PackageX, X } from 'lucide-react'
import { useAdminAlerts } from '../../context/AdminAlertsContext'
import { useStationContext } from '../../context/StationContext'
import { formatMoney } from '../../utils/cart'
import { getItemLineTotal } from '../../utils/posCalculations'
import { timeAgo, webOrderItemCount } from '../../utils/webOrders'
import { formatQuantity, getUnitShortLabel } from '../../utils/recipeCalculations'
import { btnPrimary, btnSecondary, iconBtn } from './ui'

const itemDetails = (item) =>
  [
    ...(item.selectedOptions || []).map((o) => o.optionName),
    ...(item.selectedToppings || []).map((t) => `+ ${t.name}`),
  ].filter(Boolean).join(' · ')

// Re-renders every 30 s so "hace 2 min" stays true while a popup is open.
const useNow = () => {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

// ── New web order: takes over the screen until someone answers ─────────────
const WebOrderPopup = () => {
  const { popupOrders, importOrder, dismissOrder, snoozeOrders } = useAdminAlerts()
  const [index, setIndex] = useState(0)
  const [confirmIgnore, setConfirmIgnore] = useState(false)
  const [busy, setBusy] = useState(false)
  const now = useNow()

  const order = popupOrders[Math.min(index, popupOrders.length - 1)]
  useEffect(() => { setConfirmIgnore(false) }, [order?.id])

  useEffect(() => {
    if (!order) return undefined
    const onKey = (e) => { if (e.key === 'Escape') snoozeOrders() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [order, snoozeOrders])

  if (!order) return null

  const handleIgnore = async () => {
    if (!confirmIgnore) { setConfirmIgnore(true); return }
    setBusy(true)
    try { await dismissOrder(order.id) } catch (e) { console.error('Error ignoring web order:', e) }
    setBusy(false)
  }

  const count = popupOrders.length
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[3px] p-0 sm:p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="web-order-title"
        className="alert-pop w-full sm:max-w-md max-h-[92dvh] flex flex-col rounded-t-[28px] sm:rounded-[28px] bg-main-900 shadow-2xl overflow-hidden"
      >
        {/* Header — brand color so it reads as "the café needs you" */}
        <div className="bg-primary px-5 pt-5 pb-4 text-snow">
          <div className="flex items-start gap-3">
            <span className="alert-ring h-12 w-12 shrink-0 rounded-2xl bg-accent text-primary flex items-center justify-center">
              <BellRing size={24} className="alert-shake" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-snow/75">
                {count > 1 ? `${index + 1} de ${count} pedidos esperando` : 'Pedido por WhatsApp'}
              </p>
              <h2 id="web-order-title" className="font-display text-2xl font-semibold leading-tight">
                Nuevo pedido del menú
              </h2>
              <p className="text-sm text-snow/80 mt-0.5">
                #{order.orderId} · {timeAgo(order.createdAt, now)} · {webOrderItemCount(order)} producto{webOrderItemCount(order) !== 1 ? 's' : ''}
              </p>
            </div>
            <button type="button" onClick={snoozeOrders} aria-label="Ver después" className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-snow/80 hover:bg-snow/10 cursor-pointer">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <ul className="divide-y divide-white/10">
            {(order.items || []).map((item, i) => (
              <li key={i} className="py-2.5 flex items-start gap-3">
                <span className="min-w-8 h-8 px-1.5 rounded-lg bg-main-800 text-sm font-bold text-light-100 flex items-center justify-center tabular-nums">
                  {item.qty || 1}×
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.95rem] font-bold text-light-100">{item.name}</p>
                  {itemDetails(item) && <p className="text-xs text-light-200/70 mt-0.5">{itemDetails(item)}</p>}
                </div>
                <span className="text-sm font-semibold text-light-100 tabular-nums">{formatMoney(getItemLineTotal(item))}</span>
              </li>
            ))}
          </ul>
          {order.generalNote && (
            <p className="rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-300">
              <span className="font-bold">Nota del cliente:</span> {order.generalNote}
            </p>
          )}
          <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
            <span className="text-sm font-semibold text-light-200/75">Total</span>
            <span className="text-2xl font-bold text-light-100 tabular-nums">{formatMoney(Number(order.total || 0))}</span>
          </div>
          <p className="text-xs text-light-200/65 leading-relaxed">
            El cliente también lo envió por WhatsApp. <strong className="text-light-200/90">Importar</strong> pasa
            estos productos al ticket de Cobrar; ahí lo envías a cocina o lo cobras como siempre.
          </p>
        </div>

        <div className="border-t border-white/10 px-5 pt-3 space-y-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={() => importOrder(order.id)} autoFocus className={`${btnPrimary} w-full min-h-[52px] text-base`}>
            <Download size={18} /> Importar a Cobrar
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleIgnore}
              disabled={busy}
              className={`${btnSecondary} flex-1 ${confirmIgnore ? 'border-rose-500/40 text-rose-400' : ''}`}
            >
              {busy ? 'Ignorando…' : confirmIgnore ? 'Sí, ignorar pedido' : 'Ignorar'}
            </button>
            {count > 1 ? (
              <button type="button" onClick={() => setIndex((i) => (i + 1) % count)} className={`${btnSecondary} flex-1`}>
                Siguiente pedido
              </button>
            ) : (
              <button type="button" onClick={snoozeOrders} className={`${btnSecondary} flex-1`}>
                Ver después
              </button>
            )}
          </div>
          {confirmIgnore && (
            <p className="text-xs text-light-200/70 text-center">Desaparece de los avisos. Úsalo si el pedido es repetido o de prueba.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stock running out: toast at the top, auto-hides, stays in the bell ─────
const StockToast = () => {
  const { stockToast, closeStockToast } = useAdminAlerts()
  const { selectedStation } = useStationContext()
  const navigate = useNavigate()
  const canOpenStock = !(selectedStation?.disabledRoutes || []).includes('stock')

  useEffect(() => {
    if (!stockToast) return undefined
    const t = setTimeout(closeStockToast, 12_000)
    return () => clearTimeout(t)
  }, [stockToast, closeStockToast])

  if (!stockToast) return null
  const { items, isNew } = stockToast
  const shown = items.slice(0, 4)
  return (
    <div className="fixed top-3 inset-x-3 sm:inset-x-auto sm:right-6 sm:top-20 z-[75] sm:w-[22rem]">
      <div role="status" aria-live="polite" className="alert-slide rounded-2xl border border-amber-500/30 bg-main-900 shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 shrink-0 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <PackageX size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-light-100">
              {isNew
                ? (items.length === 1 ? 'Se está acabando un insumo' : 'Se están acabando insumos')
                : `${items.length} insumo${items.length !== 1 ? 's' : ''} por agotarse`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {shown.map((m) => (
                <li key={m.id} className="text-sm text-light-200/80 flex justify-between gap-3">
                  <span className="truncate">{m.name}</span>
                  <span className={`shrink-0 tabular-nums font-semibold ${Number(m.currentStock) <= 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                    {Number(m.currentStock) <= 0 ? 'Agotado' : `quedan ${formatQuantity(Number(m.currentStock) || 0)} ${getUnitShortLabel(m.unit)}`}
                  </span>
                </li>
              ))}
              {items.length > shown.length && <li className="text-xs text-light-200/60">y {items.length - shown.length} más</li>}
            </ul>
            {canOpenStock && (
              <button
                type="button"
                onClick={() => { closeStockToast(); navigate('/admin/stock') }}
                className="mt-3 min-h-[40px] px-3.5 rounded-xl bg-amber-500/15 text-amber-400 text-sm font-bold hover:bg-amber-500/25 cursor-pointer"
              >
                Ver inventario
              </button>
            )}
          </div>
          <button type="button" onClick={closeStockToast} aria-label="Cerrar aviso" className={iconBtn}>
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Bar under the topbar while web orders wait (after "Ver después") ───────
export const PendingOrdersBar = () => {
  const { pendingOrders, popupOrders, reopenOrders } = useAdminAlerts()
  if (pendingOrders.length === 0 || popupOrders.length > 0) return null
  const n = pendingOrders.length
  return (
    <button
      type="button"
      onClick={reopenOrders}
      className="w-full shrink-0 flex items-center justify-center gap-2 min-h-[44px] px-4 bg-accent text-primary text-sm font-bold hover:brightness-95 transition cursor-pointer"
    >
      <MessageCircle size={17} />
      {n === 1 ? '1 pedido del menú esperando' : `${n} pedidos del menú esperando`}
      <span className="underline underline-offset-2">Revisar</span>
    </button>
  )
}

// ── One-time ask for system notifications (needs a tap to work on Safari) ──
const PERMISSION_DISMISS_KEY = 'bk_notif_prompt_dismissed'

const NotificationPrompt = () => {
  const { permission, askPermission, canTakeOrders } = useAdminAlerts()
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(PERMISSION_DISMISS_KEY) === '1' } catch { return false }
  })
  if (permission !== 'default' || dismissed || !canTakeOrders) return null
  const close = () => {
    try { localStorage.setItem(PERMISSION_DISMISS_KEY, '1') } catch { /* private mode */ }
    setDismissed(true)
  }
  return (
    <div className="fixed bottom-24 md:bottom-6 inset-x-3 md:inset-x-auto md:right-6 z-[74] md:w-[23rem]">
      <div className="alert-slide rounded-2xl bg-main-900 border border-white/10 shadow-2xl p-4 flex items-start gap-3">
        <span className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary dark:text-main-300 flex items-center justify-center">
          <AlertTriangle size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-light-100">Activa los avisos de pedidos</p>
          <p className="text-sm text-light-200/75 mt-0.5 leading-snug">
            Así te avisamos con sonido y notificación aunque estés en otra pestaña o ventana.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { askPermission(); close() }} className={btnPrimary}>Activar avisos</button>
            <button type="button" onClick={close} className={btnSecondary}>Ahora no</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const AdminAlerts = () => (
  <>
    <WebOrderPopup />
    <StockToast />
    <NotificationPrompt />
  </>
)
