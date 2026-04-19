import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Navbar } from '../components/Navbar'
import { PromoCarousel } from '../components/PromoCarousel'
import { CartButton } from '../components/CartButton'
import { CartOverlay } from '../components/CartOverlay'
import { ToppingsOverlay } from '../components/ToppingsOverlay'
import { BottomSheet } from '../components/BottomSheet'
import { PromoBanner } from '../components/PromoBanner'
import { SectionsList } from '../components/SectionsList'
import { CategoryTabs } from '../components/CategoryTabs'
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { usePromotion } from '../hooks/usePromotion'
import { useSections } from '../hooks/useSections'
import { flyToCart, formatMoney, getCartKey } from '../utils/cart'
import { db } from '../firebase'

export const Home = () => {
  const location = useLocation()
  const WHATSAPP_NUMBER = '5574182443'

  // Cart + overlay state.
  const [cart, setCart] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')

  // Toppings map: docId → {id, name, price}
  const [toppingsMap, setToppingsMap] = useState({})

  // ── BottomSheet state ─────────────────────────────────────────────────────
  // Product currently open in the BottomSheet (null = closed).
  // Shape: { id, name, price, desc, long_desc, imageUrl, image, fromRect,
  //          flyImageSrc, availableToppings, optionGroups }
  const [bottomSheetProduct, setBottomSheetProduct] = useState(null)

  // When BottomSheet completes and the product ALSO has toppings, we park the
  // partial result here before showing the ToppingsOverlay.
  // Shape: { ...product fields, selectedOptions, qty }
  const [pendingBottomSheetResult, setPendingBottomSheetResult] = useState(null)

  // ── ToppingsOverlay state ─────────────────────────────────────────────────
  // Pending item waiting for topping selection before being added.
  // Shape: { id, name, price, option, fromRect, flyImageSrc, availableToppings }
  const [pendingToppingItem, setPendingToppingItem] = useState(null)

  // Cart item being edited (to change its toppings).
  const [editingToppingCartItemId, setEditingToppingCartItemId] = useState(null)

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(null), 2000)
  }

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }, [])

  // ── Sections / promos ─────────────────────────────────────────────────────
  const { sections, isLoading: sectionsLoading, error: sectionsError } = useSections()
  const { promotion } = usePromotion()
  const cartBtnRef = useRef(null)
  const [isPromoVisible, setIsPromoVisible] = useState(true)
  const [activeSection, setActiveSection] = useState('')
  const activeSectionInitialized = useRef(false)

  const visibleSections = sections.filter(
    (s) =>
      `/${s.category?.toLowerCase?.()}` === location.pathname ||
      location.pathname === '/'
  )

  // Load all toppings once on mount.
  useEffect(() => {
    let active = true
    getDocs(collection(db, 'toppings'))
      .then((snap) => {
        if (!active) return
        const map = {}
        snap.docs.forEach((d) => {
          const data = d.data()
          if (data.isActive !== false) {
            map[d.id] = { id: d.id, name: data.name, price: Number(data.price || 0) }
          }
        })
        setToppingsMap(map)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // ── Cart metrics ──────────────────────────────────────────────────────────
  const cartCount = cart.reduce((sum, item) => sum + (item.qty || 0), 0)

  const cartTotal = cart.reduce((sum, item) => {
    const toppingsPrice = (item.selectedToppings || []).reduce(
      (s, t) => s + Number(t.price || 0),
      0
    )
    const optionsPrice = (item.selectedOptions || []).reduce(
      (s, o) => s + Number(o.priceModifier || 0),
      0
    )
    return (
      sum + (Number(item.price || 0) + toppingsPrice + optionsPrice) * (item.qty || 0)
    )
  }, 0)

  const clearCart = () => {
    setCart([])
    setOrderNotes('')
  }

  // ── Core cart mutators ────────────────────────────────────────────────────

  // Writes a resolved item into the cart (merges if identical key).
  // qty param lets the BottomSheet add multiple units at once.
  const _commitToCart = ({
    id,
    name,
    price,
    option = null,
    fromRect = null,
    flyImageSrc = null,
    selectedToppings = [],
    availableToppings = [],
    selectedOptions = [],
    qty: addQty = 1,
  }) => {
    if (fromRect) {
      flyToCart({ fromRect, imgSrc: flyImageSrc, target: cartBtnRef.current })
    }

    setCart((prev) => {
      const toppingIds = selectedToppings.map((t) => t.id)
      const optionIds = selectedOptions.map((o) => o.optionId)
      const key = getCartKey(id, option, toppingIds, optionIds)

      const idx = prev.findIndex((it) => {
        const itToppingIds = (it.selectedToppings || []).map((t) => t.id)
        const itOptionIds = (it.selectedOptions || []).map((o) => o.optionId)
        return getCartKey(it.id, it.option, itToppingIds, itOptionIds) === key
      })

      if (idx === -1) {
        return [
          ...prev,
          {
            cartItemId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            id,
            name,
            price,
            option,
            qty: addQty,
            selectedToppings,
            availableToppings,
            selectedOptions,
          },
        ]
      }

      const next = [...prev]
      next[idx] = { ...next[idx], qty: (next[idx].qty || 0) + addQty }
      return next
    })
  }

  // Entry point called by MenuCard / PromoCarousel "Agregar" buttons.
  const addToCart = ({
    id,
    name,
    price,
    desc = '',
    long_desc = '',
    image = null,
    imageUrl = null,
    option = null,
    fromRect = null,
    flyImageSrc = null,
    availableToppings = [],
    optionGroups = [],
  }) => {
    // 1. Has option groups → open BottomSheet
    if (Array.isArray(optionGroups) && optionGroups.length > 0) {
      setBottomSheetProduct({
        id, name, price, desc, long_desc, image, imageUrl,
        option, fromRect, flyImageSrc, availableToppings, optionGroups,
      })
      return
    }

    // 2. Has toppings only → open ToppingsOverlay
    if (availableToppings.length > 0) {
      setPendingToppingItem({
        id, name, price, option, fromRect, flyImageSrc, availableToppings,
      })
      return
    }

    // 3. No options / toppings → add directly + toast
    _commitToCart({ id, name, price, option, fromRect, flyImageSrc, selectedToppings: [], selectedOptions: [] })
    showToast('¡Agregado! 🧋')
  }

  // Called when the BottomSheet's "Agregar al carrito" button is tapped.
  const handleBottomSheetConfirm = ({ selectedOptions, qty }) => {
    if (!bottomSheetProduct) return
    const {
      id, name, price, option, fromRect, flyImageSrc, availableToppings,
    } = bottomSheetProduct

    setBottomSheetProduct(null) // closes the sheet

    if (availableToppings.length > 0) {
      // Park partial result; continue to ToppingsOverlay
      setPendingBottomSheetResult({
        id, name, price, option, fromRect, flyImageSrc,
        availableToppings, selectedOptions, qty,
      })
      setPendingToppingItem({ id, name, price, option, fromRect, flyImageSrc, availableToppings })
      return
    }

    _commitToCart({
      id, name, price, option, fromRect, flyImageSrc,
      selectedToppings: [],
      availableToppings,
      selectedOptions,
      qty,
    })
    showToast('¡Agregado! 🧋')
  }

  // Called when ToppingsOverlay confirms a selection (add flow).
  const handleToppingConfirmAdd = (selectedToppings) => {
    if (pendingBottomSheetResult) {
      // Came via BottomSheet → ToppingsOverlay path
      const {
        id, name, price, option, fromRect, flyImageSrc,
        availableToppings, selectedOptions, qty,
      } = pendingBottomSheetResult
      _commitToCart({
        id, name, price, option, fromRect, flyImageSrc,
        selectedToppings,
        availableToppings,
        selectedOptions,
        qty,
      })
      setPendingBottomSheetResult(null)
      showToast('¡Agregado! 🧋')
    } else {
      if (!pendingToppingItem) return
      const { id, name, price, option, fromRect, flyImageSrc, availableToppings } =
        pendingToppingItem
      _commitToCart({
        id, name, price, option, fromRect, flyImageSrc,
        selectedToppings,
        availableToppings,
        selectedOptions: [],
        qty: 1,
      })
    }
    setPendingToppingItem(null)
  }

  // Called when ToppingsOverlay confirms a selection (edit flow).
  const handleToppingConfirmEdit = (selectedToppings) => {
    if (!editingToppingCartItemId) return
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === editingToppingCartItemId
          ? { ...item, selectedToppings }
          : item
      )
    )
    setEditingToppingCartItemId(null)
  }

  // Adjust quantity by delta; removes item when it hits 0.
  const changeQty = (cartItemId, delta) => {
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.cartItemId === cartItemId)
      if (idx === -1) return prev

      const next = [...prev]
      const nextQty = (next[idx].qty || 0) + delta
      if (nextQty <= 0) {
        next.splice(idx, 1)
        return next
      }

      next[idx] = { ...next[idx], qty: nextQty }
      return next
    })
  }

  // ── WhatsApp order ────────────────────────────────────────────────────────
  const buildOrderMessage = () => {
    const notes = orderNotes.trim()
    const lines = [
      'Pedido BK Menu',
      '',
      'Items:',
      ...cart.map((item, idx) => {
        const optionText = item.option ? ` (${item.option})` : ''

        const selectedOptionsText =
          item.selectedOptions?.length
            ? ` [${item.selectedOptions
                .map((o) =>
                  o.priceModifier > 0
                    ? `${o.optionName} (+$${o.priceModifier})`
                    : o.optionName
                )
                .join(', ')}]`
            : ''

        const toppingsText =
          item.selectedToppings?.length
            ? ` [${item.selectedToppings.map((t) => t.name).join(', ')}]`
            : ''

        const toppingsPrice = (item.selectedToppings || []).reduce(
          (s, t) => s + Number(t.price || 0),
          0
        )
        const optionsPrice = (item.selectedOptions || []).reduce(
          (s, o) => s + Number(o.priceModifier || 0),
          0
        )
        const unitTotal = Number(item.price || 0) + toppingsPrice + optionsPrice
        const lineTotal = unitTotal * (item.qty || 0)
        return `${idx + 1}. ${item.qty} x ${item.name}${optionText}${selectedOptionsText}${toppingsText} - ${formatMoney(lineTotal)}`
      }),
      '',
      `Total: ${formatMoney(cartTotal)}`,
    ]

    if (notes) {
      lines.push('', `Notas: ${notes}`)
    }

    return lines.join('\n')
  }

  const handleWhatsAppOrder = () => {
    if (cart.length === 0) return
    const message = buildOrderMessage()
    saveOrderSnapshot(message, cartTotal)
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const saveOrderSnapshot = async (message, total) => {
    try {
      const orderId = `BK-${Date.now()
        .toString(36)
        .toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      await addDoc(collection(db, 'orders'), {
        orderId,
        content: message,
        total: Number(total || 0),
        createdAt: serverTimestamp(),
      })

      const snapshot = await getDocs(
        query(collection(db, 'orders'), orderBy('createdAt', 'asc'))
      )

      if (snapshot.size > 50) {
        const batch = writeBatch(db)
        const excess = snapshot.size - 50
        snapshot.docs.slice(0, excess).forEach((docSnap) => {
          batch.delete(docSnap.ref)
        })
        await batch.commit()
      }
    } catch (error) {
      console.error('Failed to save order snapshot:', error)
    }
  }

  // ── Scroll / intersection effects ─────────────────────────────────────────
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]'))
    if (!els.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target
          el.classList.remove('opacity-0', 'translate-y-6')
          el.classList.add('opacity-100', 'translate-y-0')
          observer.unobserve(el)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
    )

    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [location.pathname, sections.length])

  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-section-anchor]'))
    if (!els.length) return

    if (!activeSectionInitialized.current && els.length > 0) {
      setActiveSection(els[0].dataset.sectionAnchor)
      activeSectionInitialized.current = true
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.dataset.sectionAnchor)
          }
        })
      },
      { threshold: 0, rootMargin: '-50px 0px -40% 0px' }
    )

    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [visibleSections.length, location.pathname])

  useEffect(() => {
    if (promotion) {
      setIsPromoVisible(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promotion?.id])

  const handleTabClick = (name) => {
    const el = document.getElementById(`section-${name}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(name)
  }

  // Derived data for the toppings edit overlay
  const editingCartItem = editingToppingCartItemId
    ? cart.find((it) => it.cartItemId === editingToppingCartItemId)
    : null

  // ToppingsOverlay for "add" flow: uses pendingBottomSheetResult product name
  // when triggered after BottomSheet, or pendingToppingItem otherwise.
  const toppingOverlayAddProduct =
    pendingBottomSheetResult ?? pendingToppingItem

  // Price shown in ToppingsOverlay must include any options delta already chosen
  // in the BottomSheet so the running total is always base + options + toppings.
  const toppingOverlayPrice =
    Number(toppingOverlayAddProduct?.price ?? 0) +
    (toppingOverlayAddProduct?.selectedOptions ?? []).reduce(
      (s, o) => s + Number(o.priceModifier || 0), 0
    )

  return (
    <>
      <Navbar />
      {promotion && isPromoVisible && (
        <PromoBanner
          title={promotion.title || 'Nueva promoción'}
          message={promotion.message || ''}
          onClose={() => setIsPromoVisible(false)}
        />
      )}

      <style>{`
        @keyframes cartbump {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes toastIn {
          0%   { opacity: 0; transform: translate(-50%, -8px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {/* ── Brief add-to-cart toast ──────────────────────────────────── */}
      {toast && (
        <div
          className="fixed left-1/2 pointer-events-none"
          style={{
            top: 72,
            zIndex: 9100,
            animation: 'toastIn 200ms ease-out forwards',
          }}
        >
          <div
            className="rounded-full px-5 py-2.5 text-sm font-semibold shadow-2xl"
            style={{
              background: '#1c0d05',
              border: '1px solid rgba(120,60,20,0.4)',
              color: '#faf6f0',
              transform: 'translateX(-50%)',
            }}
          >
            {toast}
          </div>
        </div>
      )}

      <PromoCarousel onAddToCart={addToCart} toppingsMap={toppingsMap} />

      {visibleSections.length > 1 && (
        <CategoryTabs
          sections={visibleSections}
          activeSection={activeSection}
          onTabClick={handleTabClick}
        />
      )}

      <div className="mb-24 sm:mb-50">
        <SectionsList
          isLoading={sectionsLoading}
          error={sectionsError}
          sections={sections}
          pathname={location.pathname}
          onAddToCart={addToCart}
          toppingsMap={toppingsMap}
        />
      </div>

      <CartButton
        ref={cartBtnRef}
        isOpen={isCartOpen}
        count={cartCount}
        total={cartTotal}
        onClick={() => setIsCartOpen((v) => !v)}
      />

      <CartOverlay
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        cartCount={cartCount}
        cartTotal={cartTotal}
        orderNotes={orderNotes}
        setOrderNotes={setOrderNotes}
        onChangeQty={changeQty}
        onOrder={handleWhatsAppOrder}
        onClearCart={clearCart}
        onEditToppings={(cartItemId) => setEditingToppingCartItemId(cartItemId)}
      />

      {/* ── BottomSheet — option groups ──────────────────────────────── */}
      <BottomSheet
        isOpen={Boolean(bottomSheetProduct)}
        onClose={() => setBottomSheetProduct(null)}
        product={bottomSheetProduct}
        onConfirm={handleBottomSheetConfirm}
      />

      {/* ── ToppingsOverlay — add flow ────────────────────────────────── */}
      <ToppingsOverlay
        isOpen={Boolean(pendingToppingItem)}
        onClose={() => {
          setPendingToppingItem(null)
          setPendingBottomSheetResult(null)
        }}
        productName={toppingOverlayAddProduct?.name ?? ''}
        productPrice={toppingOverlayPrice}
        toppings={toppingOverlayAddProduct?.availableToppings ?? []}
        initialSelected={[]}
        onConfirm={handleToppingConfirmAdd}
        confirmLabel="Agregar al carrito"
      />

      {/* ── ToppingsOverlay — edit flow ───────────────────────────────── */}
      <ToppingsOverlay
        isOpen={Boolean(editingToppingCartItemId)}
        onClose={() => setEditingToppingCartItemId(null)}
        productName={editingCartItem?.name ?? ''}
        productPrice={
          Number(editingCartItem?.price ?? 0) +
          (editingCartItem?.selectedOptions ?? []).reduce(
            (s, o) => s + Number(o.priceModifier || 0), 0
          )
        }
        toppings={editingCartItem?.availableToppings ?? []}
        initialSelected={editingCartItem?.selectedToppings ?? []}
        onConfirm={handleToppingConfirmEdit}
        confirmLabel="Guardar cambios"
      />
    </>
  )
}
