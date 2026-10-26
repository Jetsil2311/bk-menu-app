import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Navbar } from '../components/Navbar'
import { MenuHero } from '../components/MenuHero'
import Logo from '../assets/bklogo.svg'
import { PromoCarousel } from '../components/PromoCarousel'
import { CartButton } from '../components/CartButton'
import { CartOverlay } from '../components/CartOverlay'
import { ToppingsOverlay } from '../components/ToppingsOverlay'
import { BottomSheet } from '../components/BottomSheet'
import { PromoBanner } from '../components/PromoBanner'
import { SectionsList } from '../components/SectionsList'
import { CategoryTabs } from '../components/CategoryTabs'
import { DrinkBuilder } from '../components/drinkBuilder/DrinkBuilder'
import { DrinkBuilderCard } from '../components/drinkBuilder/DrinkBuilderCard'
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { usePromotion } from '../hooks/usePromotion'
import { useSections } from '../hooks/useSections'
import { useSettings } from '../hooks/useSettings'
import { useDrinkBuilder } from '../hooks/useDrinkBuilder'
import { DRINK_BUILDER_HASH } from '../utils/drinkBuilder'
import { flyToCart, formatMoney, getCartKey } from '../utils/cart'
import { toSafeItems } from '../utils/posCalculations'
import { db, isTestEnv } from '../firebase'

export const Home = () => {
  const location = useLocation()
  // Orders go to the number set in Admin → Ajustes → "WhatsApp para pedidos"
  // (settings/general.orderNotificationPhone). Falls back to the original
  // hardcoded number while unset.
  // In test mode (npm run dev:test) there is no fallback: test orders open
  // WhatsApp without a recipient so they never reach the café.
  const { settings } = useSettings()
  const WHATSAPP_NUMBER =
    String(settings?.orderNotificationPhone || '').replace(/\D/g, '') || (isTestEnv ? '' : '5574182443')

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

  // ── "Arma tu bebida" builder ──────────────────────────────────────────────
  // Config lives in settings/drinkBuilder; while it isn't set up, the menu
  // shows nothing. Opening adds #arma-tu-bebida to the URL so the link can
  // be shared and the phone's back button closes the builder.
  const { config: builderConfig } = useDrinkBuilder()
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const builderPushedHash = useRef(false)

  const openBuilder = () => {
    if (window.location.hash !== DRINK_BUILDER_HASH) {
      window.history.pushState(window.history.state, '', DRINK_BUILDER_HASH)
      builderPushedHash.current = true
    }
    setIsBuilderOpen(true)
  }

  const closeBuilder = () => {
    setIsBuilderOpen(false)
    if (window.location.hash !== DRINK_BUILDER_HASH) return
    if (builderPushedHash.current) {
      builderPushedHash.current = false
      window.history.back()
    } else {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
  }

  useEffect(() => {
    if (!builderConfig) return
    if (window.location.hash === DRINK_BUILDER_HASH) setIsBuilderOpen(true)
    const onPop = () => {
      const open = window.location.hash === DRINK_BUILDER_HASH
      if (!open) builderPushedHash.current = false
      setIsBuilderOpen(open)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [builderConfig])

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
    stationTags = [],
    productDocId = null,
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
            stationTags,
            productDocId,
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

  // Called when the drink builder's "Agregar" button is tapped.
  const handleBuilderAdd = ({ item, qty, fromRect }) => {
    closeBuilder()
    _commitToCart({ ...item, qty, fromRect, flyImageSrc: null })
    showToast('¡Tu creación va al carrito!')
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
    saveOrderSnapshot(message, cartTotal, cart, orderNotes)
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // `items` is stored in the exact same shape POS.jsx's own tickets use
  // (toSafeItems) so the admin side can load every product straight into the
  // POS ticket with one click, instead of the cashier re-typing the order
  // from the WhatsApp text message.
  const saveOrderSnapshot = async (message, total, items = [], notes = '') => {
    try {
      const orderId = `BK-${Date.now()
        .toString(36)
        .toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      await addDoc(collection(db, 'orders'), {
        orderId,
        content: message,
        total: Number(total || 0),
        items: toSafeItems(items),
        generalNote: notes.trim() || null,
        source: 'whatsapp',
        reviewed: false,
        createdAt: serverTimestamp(),
      })
      // No trimming here: the menu used to keep only the newest 50 orders,
      // which deleted paid sales history. Abandoned snapshots are cleaned up
      // by the admin panel instead (utils/orderCleanup.js).
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
    <div className="menu-bg font-body text-ink min-h-dvh">
      <Navbar />
      <MenuHero />
      {promotion && isPromoVisible && !isCartOpen && (
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
          0%   { opacity: 0; transform: translateY(-8px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* ── Brief add-to-cart toast ──────────────────────────────────── */}
      {toast && (
        <div
          className="fixed inset-x-0 flex justify-center pointer-events-none"
          style={{
            top: 72,
            zIndex: 9100,
            animation: 'toastIn 200ms ease-out forwards',
          }}
        >
          <div
            role="status"
            aria-live="polite"
            className="rounded-full bg-ink px-5 py-2.5 font-display text-base font-medium text-surface shadow-[0_14px_30px_-10px_var(--color-ink)]"
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
          onBuildDrink={builderConfig && location.pathname !== '/alimentos' ? openBuilder : undefined}
          buildDrinkLabel={builderConfig?.title}
        />
      )}

      <main className="pb-6">
        {builderConfig && location.pathname !== '/alimentos' && (
          <DrinkBuilderCard config={builderConfig} onOpen={openBuilder} />
        )}
        <SectionsList
          isLoading={sectionsLoading}
          error={sectionsError}
          sections={sections}
          pathname={location.pathname}
          onAddToCart={addToCart}
          toppingsMap={toppingsMap}
        />
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="relative mt-10 bg-primary pb-32 pt-14 text-center text-surface sm:pb-16">
        <svg
          className="absolute bottom-full left-0 block h-8 w-full text-primary"
          viewBox="0 0 400 32"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 18 C 50 30, 100 30, 150 16 S 250 2, 300 16 S 370 30, 400 18 L400 32 L0 32 Z" fill="currentColor" />
        </svg>
        <img src={Logo} alt="Bubble Kaapeh" className="mx-auto h-12 opacity-90" />
        <p className="mt-3 font-display text-lg">Hecho con cariño y mucha tapioca</p>
        <p className="mt-1 text-sm text-surface/70">Haz tu pedido aquí y te lo confirmamos por WhatsApp.</p>
      </footer>

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

      {builderConfig && (
        <DrinkBuilder
          isOpen={isBuilderOpen}
          onClose={closeBuilder}
          config={builderConfig}
          onAdd={handleBuilderAdd}
        />
      )}

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
    </div>
  )
}
