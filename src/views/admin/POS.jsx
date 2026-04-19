/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, doc,
  serverTimestamp, where, query, onSnapshot,
  increment, deleteDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { formatMoney } from '../../utils/cart'
import { MoneyInput } from '../../components/MoneyInput'
import { BottomSheet } from '../../components/BottomSheet'
import { ToppingsOverlay } from '../../components/ToppingsOverlay'
import { useRegister } from '../../hooks/useRegister'
import { RegisterOverlay } from '../../components/admin/RegisterOverlay'
import {
  ShoppingCart, Search, X, Plus, Minus, User, UserPlus,
  CreditCard, Banknote, Wallet, Package, CheckCircle2,
  Receipt, PenLine, Bookmark, RotateCcw,
  Trash2, ChevronDown, Clock, AlertCircle as AlertCircleIcon,
} from 'lucide-react'

const BASE_URL = import.meta.env.BASE_URL

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayKey = () => {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const itemLineTotal = (item) =>
  (Number(item.price || 0)
    + (item.selectedOptions || []).reduce((s, o) => s + Number(o.priceModifier || 0), 0)
    + (item.selectedToppings || []).reduce((s, t) => s + Number(t.price || 0), 0)
  ) * (item.qty || 0)

const calcOrderTotal = (items) => items.reduce((s, it) => s + itemLineTotal(it), 0)

// ─── TicketItem ───────────────────────────────────────────────────────────────

const TicketItem = ({ item, onChangeQty, onRemove, onSetNote }) => {
  const [noteOpen, setNoteOpen] = useState(false)
  const optSummary = item.selectedOptions?.map(o => o.optionName).join(', ') ?? ''
  const topSummary = item.selectedToppings?.map(t => t.name).join(', ') ?? ''

  return (
    <div className="border-b border-white/5 last:border-0">
      <div className="flex items-start gap-2 px-4 py-3">
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button onClick={() => onChangeQty(item.cartItemId, -1)}
            className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-light-200/60 hover:text-light-100 transition-colors cursor-pointer">
            <Minus size={12} />
          </button>
          <span className="w-5 text-center text-sm font-bold text-light-100 select-none">{item.qty}</span>
          <button onClick={() => onChangeQty(item.cartItemId, 1)}
            className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-light-200/60 hover:text-light-100 transition-colors cursor-pointer">
            <Plus size={12} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-light-100 leading-snug">{item.name}</p>
          {(optSummary || topSummary) && (
            <p className="text-xs text-light-200/40 mt-0.5 leading-relaxed truncate">
              {[optSummary, topSummary].filter(Boolean).join(' · ')}
            </p>
          )}
          {item.itemNote && !noteOpen && (
            <p className="text-xs text-amber-400/70 mt-0.5 truncate">✎ {item.itemNote}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <span className="text-sm font-semibold text-light-100 min-w-[56px] text-right tabular-nums">
            {formatMoney(itemLineTotal(item))}
          </span>
          <button onClick={() => setNoteOpen(v => !v)} title="Nota del item"
            className="h-7 w-7 rounded-lg flex items-center justify-center text-light-200/25 hover:text-amber-400 transition-colors cursor-pointer">
            <PenLine size={13} />
          </button>
          <button onClick={() => onRemove(item.cartItemId)}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-light-200/25 hover:text-rose-400 transition-colors cursor-pointer">
            <X size={13} />
          </button>
        </div>
      </div>

      {noteOpen && (
        <div className="px-4 pb-3">
          <input type="text" placeholder="Nota para este item..."
            value={item.itemNote || ''} onChange={e => onSetNote(item.cartItemId, e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-main-800/60 px-3 py-1.5 text-xs text-light-200 placeholder-light-200/25 outline-none focus:border-amber-700/40 transition" />
        </div>
      )}
    </div>
  )
}

// ─── ParkedOrderCard ──────────────────────────────────────────────────────────

const ParkedOrderCard = ({ order, onResume, onDelete }) => {
  const items   = order.items || []
  const total   = calcOrderTotal(items)
  const count   = items.reduce((s, it) => s + (it.qty || 1), 0)
  const preview = items[0]?.name ?? '—'
  const timeStr = order.parkedAt?.toDate?.()?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) ?? '—'

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-light-100 truncate">
          {preview}{count > 1 ? ` +${count - 1} más` : ''}
        </p>
        <p className="text-xs text-light-200/35 flex items-center gap-1 mt-0.5">
          <Clock size={10} />
          {timeStr}
          {order.customer && <><span className="mx-1 opacity-40">·</span>{order.customer.name}</>}
        </p>
      </div>
      <span className="text-sm font-bold text-light-100 tabular-nums shrink-0">{formatMoney(total)}</span>
      <button onClick={() => onResume(order)}
        className="shrink-0 h-8 w-8 rounded-xl bg-main-500/20 border border-main-500/30 flex items-center justify-center text-main-400 hover:bg-main-500/30 transition-all cursor-pointer"
        title="Retomar">
        <RotateCcw size={14} />
      </button>
      <button onClick={() => onDelete(order.id)}
        className="shrink-0 h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center text-light-200/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
        title="Eliminar">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ─── PaymentModal ─────────────────────────────────────────────────────────────

const PaymentModal = ({
  customer, loyaltyMax,
  cashAmount, setCashAmount,
  cardAmount, setCardAmount,
  loyaltyRedeemed, setLoyaltyRedeemed,
  effectiveTotal, change, canConfirm, isProcessing,
  onConfirm, onClose,
}) => {
  const totalPaid  = cashAmount + cardAmount + loyaltyRedeemed
  const remaining  = Math.max(0, effectiveTotal - totalPaid)

  return (
    <div className="fixed inset-0 z-[9100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-main-900 border border-white/8 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h3 className="text-lg font-bold text-light-100 flex items-center gap-2">
            <Receipt size={20} className="text-main-400" />
            Cobrar orden
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5 text-light-200/50 cursor-pointer transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          <div className="flex items-baseline justify-between rounded-2xl bg-main-950 border border-white/5 px-5 py-4">
            <span className="text-sm text-light-200/50">Total a cobrar</span>
            <span className="text-3xl font-bold text-light-100 tabular-nums">{formatMoney(effectiveTotal)}</span>
          </div>

          {/* Loyalty redemption */}
          {customer && loyaltyMax > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-amber-400" />
                <span className="text-sm font-semibold text-amber-200">
                  {customer.name} — Saldo: {formatMoney(customer.loyaltyBalance || 0)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-light-200/50 shrink-0">Redimir:</span>
                <MoneyInput
                  value={loyaltyRedeemed}
                  onChange={v => setLoyaltyRedeemed(Math.min(loyaltyMax, v))}
                  max={loyaltyMax}
                  inputClassName="w-28 rounded-xl border border-amber-500/30 bg-main-800/60 py-1.5 text-sm text-light-200 outline-none focus:border-amber-500/50 transition"
                />
                <button onClick={() => setLoyaltyRedeemed(loyaltyMax)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer transition-colors whitespace-nowrap">
                  Usar todo
                </button>
              </div>
              {loyaltyRedeemed > 0 && <p className="text-xs text-emerald-400">Descuento: -{formatMoney(loyaltyRedeemed)}</p>}
            </div>
          )}

          {/* Cash */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-light-200/70">
              <Banknote size={16} className="text-emerald-400" />
              Efectivo recibido
            </label>
            <MoneyInput
              value={cashAmount}
              onChange={setCashAmount}
              inputClassName="rounded-2xl border border-white/10 bg-main-950 py-3 text-lg text-light-200 placeholder-light-200/25 outline-none focus:border-emerald-700/40 transition"
            />
            {cashAmount > 0 && change > 0.005 && (
              <p className="text-sm font-semibold text-emerald-400 tabular-nums">Cambio: {formatMoney(change)}</p>
            )}
          </div>

          {/* Card */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-light-200/70">
              <CreditCard size={16} className="text-blue-400" />
              Cargo a tarjeta
            </label>
            <MoneyInput
              value={cardAmount}
              onChange={setCardAmount}
              inputClassName="rounded-2xl border border-white/10 bg-main-950 py-3 text-lg text-light-200 placeholder-light-200/25 outline-none focus:border-blue-700/40 transition"
            />
          </div>

          {remaining > 0.005 && (
            <div className="flex items-center gap-2 text-sm text-rose-400 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
              <AlertCircleIcon size={16} />
              Falta cubrir: {formatMoney(remaining)}
            </div>
          )}
        </div>

        <div className="px-6 py-5 border-t border-white/5">
          <button onClick={onConfirm} disabled={!canConfirm || isProcessing}
            className="w-full rounded-2xl bg-main-500 hover:bg-main-400 disabled:opacity-40 disabled:cursor-not-allowed py-4 text-base font-bold text-white transition-all cursor-pointer shadow-lg shadow-main-500/20">
            {isProcessing ? 'Procesando...' : `Confirmar · ${formatMoney(effectiveTotal)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── POS ─────────────────────────────────────────────────────────────────────

export const POS = () => {
  const { loading: registerLoading } = useRegister()

  // ── Catalog ────────────────────────────────────────────────────────────────
  const [sections, setSections]         = useState([])
  const [allProducts, setAllProducts]   = useState([])
  const [toppingsMap, setToppingsMap]   = useState({})
  const [activeSection, setActiveSection] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [productSearch, setProductSearch]   = useState('')

  // ── Order ──────────────────────────────────────────────────────────────────
  const [orderItems, setOrderItems]   = useState([])
  const [generalNote, setGeneralNote] = useState('')

  // ── Parked orders ──────────────────────────────────────────────────────────
  const [parkedOrders, setParkedOrders] = useState([])
  const [ticketTab, setTicketTab]       = useState('active')  // 'active' | 'parked'

  // ── Overlay state (mirrors Home.jsx exactly) ───────────────────────────────
  const [bottomSheetProduct, setBottomSheetProduct]         = useState(null)
  const [pendingBottomSheetResult, setPendingBottomSheetResult] = useState(null)
  const [pendingToppingItem, setPendingToppingItem]         = useState(null)

  // ── Customer ───────────────────────────────────────────────────────────────
  const [customer, setCustomer]           = useState(null)
  const [customerPanelOpen, setCustomerPanelOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching]     = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustName, setNewCustName]     = useState('')
  const [newCustPhone, setNewCustPhone]   = useState('')
  const [savingCust, setSavingCust]       = useState(false)

  // ── Payment (money state as numbers, not strings) ──────────────────────────
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [cashAmount, setCashAmount]       = useState(0)
  const [cardAmount, setCardAmount]       = useState(0)
  const [loyaltyRedeemed, setLoyaltyRedeemed] = useState(0)
  const [isProcessing, setIsProcessing]   = useState(false)
  const [orderSuccess, setOrderSuccess]   = useState(null)

  // ── Mobile ticket ──────────────────────────────────────────────────────────
  const [isTicketOpen, setIsTicketOpen] = useState(false)

  // ── Load catalog ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    Promise.all([
      getDocs(collection(db, 'sections')),
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'toppings')),
    ]).then(([sectSnap, prodSnap, topSnap]) => {
      if (!alive) return
      const secs = sectSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.visible !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setSections(secs)
      if (secs.length) setActiveSection(secs[0].name)

      setAllProducts(prodSnap.docs
        .map(d => ({ docId: d.id, id: d.data().id ?? d.id, ...d.data() }))
        .filter(p => p.isActive !== false)
      )

      const tMap = {}
      topSnap.docs.forEach(d => {
        const data = d.data()
        if (data.isActive !== false) tMap[d.id] = { id: d.id, name: data.name, price: Number(data.price || 0) }
      })
      setToppingsMap(tMap)
      setCatalogLoading(false)
    }).catch(() => setCatalogLoading(false))
    return () => { alive = false }
  }, [])

  // ── Parked orders (real-time) ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'parked_orders'),
      snap => {
        const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        orders.sort((a, b) => {
          const ta = a.parkedAt?.toDate?.() ?? new Date(0)
          const tb = b.parkedAt?.toDate?.() ?? new Date(0)
          return tb - ta
        })
        setParkedOrders(orders)
      },
      () => {},
    )
    return unsub
  }, [])

  // ── Customer search — debounced ───────────────────────────────────────────
  useEffect(() => {
    if (!customerSearch.trim()) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setIsSearching(true)
      try {
        const q = query(
          collection(db, 'customers'),
          where('phone', '>=', customerSearch.trim()),
          where('phone', '<=', customerSearch.trim() + '\uf8ff'),
        )
        const snap = await getDocs(q)
        setSearchResults(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch { setSearchResults([]) }
      finally { setIsSearching(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [customerSearch])

  // ── Add-to-order flow (mirrors Home.jsx addToCart exactly) ────────────────
  const addToOrder = useCallback((product) => {
    const optionGroups    = Array.isArray(product.optionGroups) ? product.optionGroups : []
    const availableToppings = (product.toppingIds || []).map(tid => toppingsMap[tid]).filter(Boolean)

    if (optionGroups.length > 0) {
      setBottomSheetProduct({ ...product, availableToppings, optionGroups }); return
    }
    if (availableToppings.length > 0) {
      setPendingToppingItem({ ...product, availableToppings }); return
    }
    _commit({ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl, selectedOptions: [], selectedToppings: [], availableToppings: [], qty: 1 })
  }, [toppingsMap])

  const _commit = (item) => {
    setOrderItems(prev => {
      const idx = prev.findIndex(it =>
        it.id === item.id &&
        JSON.stringify(it.selectedOptions) === JSON.stringify(item.selectedOptions) &&
        JSON.stringify(it.selectedToppings) === JSON.stringify(item.selectedToppings)
      )
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + (item.qty || 1) }
        return next
      }
      return [...prev, { ...item, cartItemId: uid(), itemNote: '' }]
    })
  }

  const handleBottomSheetConfirm = useCallback(({ selectedOptions, qty }) => {
    if (!bottomSheetProduct) return
    const p = bottomSheetProduct
    setBottomSheetProduct(null)
    if (p.availableToppings.length > 0) {
      setPendingBottomSheetResult({ ...p, selectedOptions, qty })
      setPendingToppingItem({ ...p, availableToppings: p.availableToppings })
      return
    }
    _commit({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl, selectedOptions, selectedToppings: [], availableToppings: [], qty })
  }, [bottomSheetProduct])

  const handleToppingConfirm = useCallback((selectedToppings) => {
    if (pendingBottomSheetResult) {
      const p = pendingBottomSheetResult
      _commit({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl, selectedOptions: p.selectedOptions, selectedToppings, availableToppings: p.availableToppings, qty: p.qty })
      setPendingBottomSheetResult(null)
    } else if (pendingToppingItem) {
      const p = pendingToppingItem
      _commit({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl, selectedOptions: [], selectedToppings, availableToppings: p.availableToppings, qty: 1 })
    }
    setPendingToppingItem(null)
  }, [pendingBottomSheetResult, pendingToppingItem])

  // ── Order mutations ───────────────────────────────────────────────────────
  const changeQty = (cartItemId, delta) => {
    setOrderItems(prev => {
      const idx = prev.findIndex(it => it.cartItemId === cartItemId)
      if (idx === -1) return prev
      const newQty = prev[idx].qty + delta
      if (newQty <= 0) return prev.filter(it => it.cartItemId !== cartItemId)
      const next = [...prev]; next[idx] = { ...next[idx], qty: newQty }; return next
    })
  }
  const removeItem  = (cartItemId) => setOrderItems(prev => prev.filter(it => it.cartItemId !== cartItemId))
  const setItemNote = (cartItemId, note) =>
    setOrderItems(prev => prev.map(it => it.cartItemId === cartItemId ? { ...it, itemNote: note } : it))

  // ── Customer helpers ──────────────────────────────────────────────────────
  const selectCustomer = (c) => {
    setCustomer(c)
    setCustomerSearch('')
    setSearchResults([])
    setCustomerPanelOpen(false)
    setShowNewCustomer(false)
  }

  const saveNewCustomer = async () => {
    if (!newCustName.trim() || !newCustPhone.trim()) return
    setSavingCust(true)
    try {
      const ref = await addDoc(collection(db, 'customers'), {
        name: newCustName.trim(), phone: newCustPhone.trim(),
        loyaltyBalance: 0, visitCount: 0,
        createdAt: serverTimestamp(), lastVisit: serverTimestamp(),
      })
      selectCustomer({ id: ref.id, name: newCustName.trim(), phone: newCustPhone.trim(), loyaltyBalance: 0, visitCount: 0 })
      setNewCustName(''); setNewCustPhone('')
    } catch (e) { console.error(e) }
    finally { setSavingCust(false) }
  }

  // ── Save order to Pedidos (status Nuevo, no payment yet) ─────────────────
  const [isParking, setIsParking] = useState(false)

  const parkCurrentOrder = async () => {
    if (orderItems.length === 0 || isParking) return
    setIsParking(true)
    try {
      const orderId = `POS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
      const safeItems = orderItems.map(it => ({
        id: it.id ?? null, name: it.name ?? '', price: Number(it.price || 0),
        imageUrl: it.imageUrl ?? null, qty: it.qty ?? 1, itemNote: it.itemNote || null,
        selectedOptions: (it.selectedOptions ?? []).map(o => ({ optionName: o.optionName ?? '', priceModifier: Number(o.priceModifier || 0) })),
        selectedToppings: (it.selectedToppings ?? []).map(t => ({ id: t.id ?? null, name: t.name ?? '', price: Number(t.price || 0) })),
      }))
      const total = calcOrderTotal(safeItems)
      await addDoc(collection(db, 'orders'), {
        orderId, items: safeItems, total,
        status: 'Nuevo', source: 'pos',
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? null,
        generalNote: generalNote || null,
        loyaltyEarned: 0, loyaltyRedeemed: 0,
        createdAt: serverTimestamp(),
      })
      setOrderItems([]); setGeneralNote(''); setCustomer(null); setLoyaltyRedeemed(0)
    } catch (e) {
      console.error('Error al guardar orden:', e)
      alert('No se pudo guardar la orden. Verifica la conexión e inténtalo de nuevo.')
    } finally {
      setIsParking(false)
    }
  }

  const resumeParkedOrder = async (parkedOrder) => {
    if (orderItems.length > 0 && !window.confirm('La orden activa será reemplazada. ¿Continuar?')) return
    setOrderItems((parkedOrder.items || []).map(it => ({ ...it, cartItemId: uid(), itemNote: it.itemNote || '' })))
    setGeneralNote(parkedOrder.generalNote || '')
    setCustomer(parkedOrder.customer || null)
    setLoyaltyRedeemed(0)
    await deleteDoc(doc(db, 'parked_orders', parkedOrder.id))
    setTicketTab('active')
  }

  const deleteParkedOrder = async (id) => {
    await deleteDoc(doc(db, 'parked_orders', id))
  }

  // ── Build content string ──────────────────────────────────────────────────
  const buildContent = () => {
    const lines = ['Pedido Mi Cafetería POS', '', 'Items:',
      ...orderItems.map((it, i) => {
        const optTxt = it.selectedOptions?.length ? ` [${it.selectedOptions.map(o => o.priceModifier > 0 ? `${o.optionName} (+$${o.priceModifier})` : o.optionName).join(', ')}]` : ''
        const topTxt = it.selectedToppings?.length ? ` [${it.selectedToppings.map(t => t.name).join(', ')}]` : ''
        const noteTxt = it.itemNote ? ` (${it.itemNote})` : ''
        return `${i + 1}. ${it.qty} x ${it.name}${optTxt}${topTxt}${noteTxt} - ${formatMoney(itemLineTotal(it))}`
      }),
      '', `Total: ${formatMoney(effectiveTotal)}`,
    ]
    if (loyaltyRedeemed > 0) lines.push(`Loyalty redimido: ${formatMoney(loyaltyRedeemed)}`)
    if (generalNote) lines.push('', `Notas: ${generalNote}`)
    if (customer) lines.push('', `Cliente: ${customer.name} (${customer.phone})`)
    return lines.join('\n')
  }

  // ── Submit order ──────────────────────────────────────────────────────────
  const handlePayment = async () => {
    if (!canConfirmPayment || isProcessing) return
    setIsProcessing(true)
    try {
      const orderId = `POS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
      const loyaltyEarned = customer ? Math.round(effectiveTotal * 0.1 * 100) / 100 : 0

      const safeItems = orderItems.map(it => ({
        id: it.id ?? null, name: it.name ?? '', price: Number(it.price || 0),
        imageUrl: it.imageUrl ?? null, qty: it.qty ?? 1, itemNote: it.itemNote || null,
        selectedOptions: (it.selectedOptions ?? []).map(o => ({ optionName: o.optionName ?? '', priceModifier: Number(o.priceModifier || 0) })),
        selectedToppings: (it.selectedToppings ?? []).map(t => ({ id: t.id ?? null, name: t.name ?? '', price: Number(t.price || 0) })),
      }))

      await addDoc(collection(db, 'orders'), {
        orderId, content: buildContent(), total: effectiveTotal,
        status: 'Nuevo', source: 'pos',
        paymentMethods: { cash: cashAmount, card: cardAmount, loyalty: loyaltyRedeemed },
        customerId: customer?.id ?? null, customerName: customer?.name ?? null,
        items: safeItems, generalNote: generalNote || null,
        loyaltyEarned, loyaltyRedeemed, createdAt: serverTimestamp(),
      })

      // Increment counters in the current register session
      await updateDoc(doc(db, 'register_sessions', todayKey()), {
        cashSales: increment(cashAmount),
        cardSales: increment(cardAmount),
        loyaltyRedemptions: increment(loyaltyRedeemed),
      })

      if (customer) {
        const netLoyalty = loyaltyEarned - loyaltyRedeemed
        await updateDoc(doc(db, 'customers', customer.id), {
          loyaltyBalance: increment(netLoyalty),
          visitCount: increment(1),
          lastVisit: serverTimestamp(),
        })
      }

      const savedChange = change, savedOrderId = orderId
      setOrderItems([]); setGeneralNote(''); setLoyaltyRedeemed(0)
      setCashAmount(0); setCardAmount(0); setCustomer(null)
      setCustomerSearch(''); setIsPaymentOpen(false)
      setOrderSuccess({ orderId: savedOrderId, change: savedChange })
    } catch (e) { console.error('POS payment error:', e) }
    finally { setIsProcessing(false) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayedProducts = productSearch.trim()
    ? allProducts.filter(p => normalize(p.name).includes(normalize(productSearch.trim())))
    : allProducts.filter(p => p.section === activeSection)

  const subtotal    = calcOrderTotal(orderItems)
  const loyaltyMax  = customer ? Math.min(customer.loyaltyBalance || 0, subtotal) : 0
  const effectiveTotal = Math.max(0, subtotal - loyaltyRedeemed)
  const totalPaid   = cashAmount + cardAmount + loyaltyRedeemed
  const change      = Math.max(0, totalPaid - effectiveTotal)
  const canConfirmPayment = orderItems.length > 0 && totalPaid >= effectiveTotal
  const itemCount   = orderItems.reduce((s, it) => s + it.qty, 0)

  const toppingOverlayProduct = pendingBottomSheetResult ?? pendingToppingItem
  const toppingOverlayPrice   = Number(toppingOverlayProduct?.price ?? 0) +
    (toppingOverlayProduct?.selectedOptions ?? []).reduce((s, o) => s + Number(o.priceModifier || 0), 0)

  // ── Ticket tab bar (reused in desktop + mobile headers) ───────────────────
  const ticketTabBar = (
    <div className="flex gap-1 flex-1">
      {[
        { key: 'active', label: 'Orden Activa' },
        { key: 'parked', label: `Apartadas${parkedOrders.length > 0 ? ` (${parkedOrders.length})` : ''}` },
      ].map(tab => (
        <button key={tab.key} onClick={() => setTicketTab(tab.key)}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            ticketTab === tab.key
              ? 'bg-main-500/20 text-main-300 border border-main-500/30'
              : 'text-light-200/40 hover:text-light-200/70 hover:bg-white/5'
          }`}>
          {tab.label}
        </button>
      ))}
    </div>
  )

  // ── Customer section (compact) ────────────────────────────────────────────
  const customerSection = (
    <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
      {customer ? (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-500/[0.08] border border-amber-500/20 px-3 py-2.5">
          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <User size={15} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-200 truncate">{customer.name}</p>
            <p className="text-xs text-light-200/40 truncate">{customer.phone} · Saldo: {formatMoney(customer.loyaltyBalance || 0)}</p>
          </div>
          <button onClick={() => { setCustomer(null); setLoyaltyRedeemed(0) }}
            className="text-light-200/25 hover:text-rose-400 cursor-pointer transition-colors shrink-0">
            <X size={15} />
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setCustomerPanelOpen(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 text-sm text-light-200/40 hover:text-light-200/70 transition-all cursor-pointer"
          >
            <User size={13} className="shrink-0" />
            <span>Vincular cliente</span>
            <ChevronDown size={13} className={`ml-auto transition-transform duration-200 ${customerPanelOpen ? 'rotate-180' : ''}`} />
          </button>

          {customerPanelOpen && (
            <div className="mt-2 space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/25" />
                <input type="text" placeholder="Buscar por teléfono..."
                  value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setShowNewCustomer(false) }}
                  autoFocus
                  className="w-full rounded-xl border border-white/8 bg-main-800/50 pl-8 pr-3 py-2 text-sm text-light-200 placeholder-light-200/25 outline-none focus:border-main-500/40 transition" />
              </div>

              {customerSearch.trim() && (
                <div className="rounded-xl border border-white/5 bg-main-900/80 overflow-hidden">
                  {isSearching ? (
                    <p className="px-3 py-2.5 text-xs text-light-200/30">Buscando...</p>
                  ) : searchResults.length > 0 ? (
                    searchResults.slice(0, 4).map(c => (
                      <button key={c.id} onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors cursor-pointer">
                        <p className="text-sm font-medium text-light-100">{c.name}</p>
                        <p className="text-xs text-light-200/35">{c.phone} · {c.visitCount || 0} visitas · {formatMoney(c.loyaltyBalance || 0)}</p>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2.5 space-y-1.5">
                      <p className="text-xs text-light-200/30">Sin resultados.</p>
                      <button onClick={() => { setShowNewCustomer(true); setNewCustPhone(customerSearch) }}
                        className="flex items-center gap-1 text-xs text-main-400 hover:text-main-300 font-medium cursor-pointer transition-colors">
                        <UserPlus size={12} /> Registrar nuevo cliente
                      </button>
                    </div>
                  )}
                </div>
              )}

              {showNewCustomer && (
                <div className="rounded-xl border border-white/10 bg-main-900/60 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-light-200/40 uppercase tracking-wider">Nuevo cliente</p>
                  <input type="text" placeholder="Nombre completo" value={newCustName} onChange={e => setNewCustName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-main-800/60 px-3 py-2 text-sm text-light-200 placeholder-light-200/25 outline-none focus:border-main-500/40 transition" />
                  <input type="tel" placeholder="Teléfono" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-main-800/60 px-3 py-2 text-sm text-light-200 placeholder-light-200/25 outline-none focus:border-main-500/40 transition" />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowNewCustomer(false); setNewCustName(''); setNewCustPhone('') }}
                      className="flex-1 rounded-xl border border-white/10 py-1.5 text-xs text-light-200/40 hover:bg-white/5 transition cursor-pointer">
                      Cancelar
                    </button>
                    <button onClick={saveNewCustomer} disabled={savingCust || !newCustName.trim() || !newCustPhone.trim()}
                      className="flex-1 rounded-xl bg-main-500 hover:bg-main-400 disabled:opacity-40 py-1.5 text-xs font-semibold text-white transition cursor-pointer">
                      {savingCust ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )

  // ── Active order content ──────────────────────────────────────────────────
  const activeTicketContent = (
    <>
      {customerSection}

      <div className="flex-1 overflow-y-auto">
        {orderItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-light-200/20">
            <ShoppingCart size={32} className="mb-2" />
            <p className="text-sm">Sin productos aún</p>
          </div>
        ) : (
          orderItems.map(item => (
            <TicketItem key={item.cartItemId} item={item} onChangeQty={changeQty} onRemove={removeItem} onSetNote={setItemNote} />
          ))
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-white/5 shrink-0">
        <input type="text" placeholder="Nota general del pedido..."
          value={generalNote} onChange={e => setGeneralNote(e.target.value)}
          className="w-full rounded-xl border border-white/8 bg-main-800/50 px-3 py-2 text-sm text-light-200 placeholder-light-200/25 outline-none focus:border-main-500/40 transition" />
      </div>

      <div className="shrink-0 px-4 pt-3 pb-4 border-t border-white/8 bg-main-950/80 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-light-200/40">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</span>
          <span className="text-2xl font-bold text-light-100 tabular-nums">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={parkCurrentOrder}
            disabled={orderItems.length === 0 || isParking}
            title="Guardar orden"
            className="flex-none flex items-center gap-1.5 px-4 py-3.5 rounded-2xl border border-white/10 text-sm font-semibold text-light-200/50 hover:border-white/20 hover:text-light-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Bookmark size={15} />
            {isParking ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={() => { setIsPaymentOpen(true); setIsTicketOpen(false) }}
            disabled={orderItems.length === 0}
            className="flex-1 rounded-2xl bg-main-500 hover:bg-main-400 disabled:opacity-30 disabled:cursor-not-allowed py-3.5 text-sm font-bold text-white transition-all shadow-lg shadow-main-500/20 cursor-pointer"
          >
            Cobrar · {formatMoney(subtotal)}
          </button>
        </div>
      </div>
    </>
  )

  // ── Parked orders content ─────────────────────────────────────────────────
  const parkedTicketContent = (
    <div className="flex-1 overflow-y-auto">
      {parkedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-44 text-light-200/20 gap-3">
          <Bookmark size={32} />
          <p className="text-sm">Sin órdenes apartadas</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {parkedOrders.map(po => (
            <ParkedOrderCard key={po.id} order={po} onResume={resumeParkedOrder} onDelete={deleteParkedOrder} />
          ))}
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  if (registerLoading) return (
    <div className="flex items-center justify-center h-screen bg-main-950 text-light-200/30 text-sm animate-pulse">
      Verificando estado de caja…
    </div>
  )

  return (
    <RegisterOverlay>
      <div className="flex overflow-hidden -mx-6 md:-mx-8 -mt-6 md:-mt-8 -mb-6 md:-mb-8"
        style={{ height: 'calc(100vh - 4rem)' }}>

        {/* ── Left: Product catalog ──────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 bg-main-900 overflow-hidden">

          {/* Product search bar */}
          <div className="shrink-0 px-4 pt-3 pb-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-200/30 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-white/5 bg-main-900/50 text-sm text-light-100 placeholder:text-light-200/25 outline-none focus:border-main-500/40 transition"
              />
              {productSearch && (
                <button onClick={() => setProductSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-light-200/30 hover:text-light-200/60 cursor-pointer transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Section tabs — hidden while searching */}
          {!productSearch.trim() && (
            <div className="shrink-0 flex items-center gap-1.5 px-4 pb-3 border-b border-white/5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {catalogLoading
                ? [1, 2, 3, 4].map(i => <div key={i} className="h-7 w-20 rounded-full bg-white/5 animate-pulse shrink-0" />)
                : sections.map(sec => (
                  <button key={sec.id} onClick={() => setActiveSection(sec.name)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                      activeSection === sec.name
                        ? 'bg-main-500 text-white shadow-lg shadow-main-500/20'
                        : 'text-light-200/50 hover:text-light-100 hover:bg-white/5'
                    }`}>
                    {sec.name}
                  </button>
                ))
              }
            </div>
          )}

          {/* Search result count */}
          {productSearch.trim() && !catalogLoading && (
            <div className="shrink-0 px-4 pb-2 border-b border-white/5">
              <p className="text-xs text-light-200/30">
                {displayedProducts.length} resultado{displayedProducts.length !== 1 ? 's' : ''} para &ldquo;{productSearch}&rdquo;
              </p>
            </div>
          )}

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {catalogLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="rounded-2xl bg-main-900/30 border border-white/5 overflow-hidden">
                    <div className="aspect-[4/3] bg-white/5 animate-pulse" />
                    <div className="p-3 space-y-1.5">
                      <div className="h-3 w-3/4 rounded bg-white/5 animate-pulse" />
                      <div className="h-3 w-1/3 rounded bg-white/5 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-light-200/20 text-sm gap-2">
                <Package size={28} />
                {productSearch.trim() ? 'Sin resultados.' : 'Sin productos en esta sección.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {displayedProducts.map(product => {
                  const hasOpts = Array.isArray(product.optionGroups) && product.optionGroups.length > 0
                  const hasTop  = Array.isArray(product.toppingIds) && product.toppingIds.length > 0
                  return (
                    <button key={product.docId} type="button" onClick={() => addToOrder(product)}
                      className="text-left rounded-2xl bg-main-900/40 border border-white/5 hover:border-main-500/30 hover:bg-main-800/60 transition-all duration-200 overflow-hidden cursor-pointer group active:scale-[0.97]">
                      <div className="aspect-[4/3] bg-main-800/50 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Package size={24} className="text-light-200/10" />
                        </div>
                        {(product.imageUrl || product.image) && (
                          <img
                            src={product.imageUrl || `${BASE_URL}products/${product.id}${product.image ?? ''}`}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={e => { e.currentTarget.onerror = null; e.currentTarget.style.display = 'none' }}
                          />
                        )}
                        {(hasOpts || hasTop) && (
                          <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-black/60 text-amber-300 font-semibold backdrop-blur-sm">
                            {hasOpts ? 'Opciones' : 'Extras'}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold text-light-100 leading-snug truncate">{product.name}</p>
                        <p className="text-sm font-bold text-main-300 mt-0.5 tabular-nums">{formatMoney(Number(product.price || 0))}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Ticket — desktop ────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col w-[380px] xl:w-[420px] shrink-0 bg-main-950 border-l border-white/5 overflow-hidden">
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <ShoppingCart size={17} className="text-main-400 shrink-0" />
            {ticketTabBar}
            {ticketTab === 'active' && itemCount > 0 && (
              <span className="ml-1 h-5 min-w-[20px] px-1 rounded-full bg-main-500 text-[11px] font-bold text-white flex items-center justify-center shrink-0">
                {itemCount}
              </span>
            )}
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            {ticketTab === 'active' ? activeTicketContent : parkedTicketContent}
          </div>
        </div>

        {/* ── Mobile: floating button + sheet ───────────────────────────── */}
        <div className="lg:hidden">
          {!isTicketOpen && (
            <button
              onClick={() => setIsTicketOpen(true)}
              className="fixed bottom-6 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-main-500 text-white shadow-2xl shadow-main-500/30 font-semibold hover:bg-main-400 cursor-pointer transition-all"
            >
              <ShoppingCart size={18} />
              {itemCount > 0
                ? <><span className="text-sm font-bold">{itemCount}</span><span className="text-sm font-bold tabular-nums">{formatMoney(subtotal)}</span></>
                : parkedOrders.length > 0
                ? <span className="text-sm font-bold">{parkedOrders.length} apartada{parkedOrders.length !== 1 ? 's' : ''}</span>
                : <span className="text-sm font-bold">Ticket</span>
              }
            </button>
          )}

          {isTicketOpen && (
            <div className="fixed inset-0 z-[9050] flex flex-col justify-end">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsTicketOpen(false)} />
              <div className="relative flex flex-col bg-main-950 rounded-t-3xl border-t border-white/5 overflow-hidden" style={{ maxHeight: '85vh' }}>
                <div className="shrink-0 flex items-center gap-2 px-5 py-4 border-b border-white/5">
                  <ShoppingCart size={17} className="text-main-400 shrink-0" />
                  {ticketTabBar}
                  {ticketTab === 'active' && itemCount > 0 && (
                    <span className="h-5 min-w-[20px] px-1 rounded-full bg-main-500 text-[11px] font-bold text-white flex items-center justify-center shrink-0">{itemCount}</span>
                  )}
                  <button onClick={() => setIsTicketOpen(false)}
                    className="ml-2 p-1.5 rounded-xl hover:bg-white/5 text-light-200/50 cursor-pointer transition-colors shrink-0">
                    <X size={19} />
                  </button>
                </div>
                <div className="flex flex-col flex-1 overflow-hidden">
                  {ticketTab === 'active' ? activeTicketContent : parkedTicketContent}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Payment Modal ──────────────────────────────────────────────── */}
        {isPaymentOpen && (
          <PaymentModal
            subtotal={subtotal} customer={customer} loyaltyMax={loyaltyMax}
            cashAmount={cashAmount} setCashAmount={setCashAmount}
            cardAmount={cardAmount} setCardAmount={setCardAmount}
            loyaltyRedeemed={loyaltyRedeemed} setLoyaltyRedeemed={setLoyaltyRedeemed}
            effectiveTotal={effectiveTotal} change={change}
            canConfirm={canConfirmPayment} isProcessing={isProcessing}
            onConfirm={handlePayment} onClose={() => setIsPaymentOpen(false)}
          />
        )}

        {/* ── Order success flash ────────────────────────────────────────── */}
        {orderSuccess && (
          <div className="fixed inset-0 z-[9200] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOrderSuccess(null)} />
            <div className="relative bg-main-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
              <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-light-100">¡Orden confirmada!</h3>
              <p className="mt-1 text-xs text-light-200/35 font-mono">#{orderSuccess.orderId?.slice(-8)}</p>
              {orderSuccess.change > 0.005 && (
                <div className="mt-5 rounded-2xl bg-main-950 border border-white/5 px-6 py-4">
                  <p className="text-xs text-light-200/40 uppercase tracking-wider">Cambio a entregar</p>
                  <p className="text-4xl font-bold text-emerald-400 mt-1 tabular-nums">{formatMoney(orderSuccess.change)}</p>
                </div>
              )}
              <button onClick={() => setOrderSuccess(null)}
                className="mt-6 w-full rounded-2xl bg-main-500 hover:bg-main-400 py-3 text-sm font-semibold text-white transition cursor-pointer">
                Nueva orden
              </button>
            </div>
          </div>
        )}

        {/* ── BottomSheet ────────────────────────────────────────────────── */}
        <BottomSheet
          isOpen={Boolean(bottomSheetProduct)}
          onClose={() => setBottomSheetProduct(null)}
          product={bottomSheetProduct}
          onConfirm={handleBottomSheetConfirm}
        />

        {/* ── ToppingsOverlay ────────────────────────────────────────────── */}
        <ToppingsOverlay
          isOpen={Boolean(pendingToppingItem)}
          onClose={() => { setPendingToppingItem(null); setPendingBottomSheetResult(null) }}
          productName={toppingOverlayProduct?.name ?? ''}
          productPrice={toppingOverlayPrice}
          toppings={toppingOverlayProduct?.availableToppings ?? []}
          initialSelected={[]}
          onConfirm={handleToppingConfirm}
          confirmLabel="Agregar al pedido"
        />
      </div>
    </RegisterOverlay>
  )
}
