import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Navbar } from '../components/Navbar'
import { PromoCarousel } from '../components/PromoCarousel'
import { CartButton } from '../components/CartButton'
import { CartOverlay } from '../components/CartOverlay'
import { ToppingsOverlay } from '../components/ToppingsOverlay'
import { PromoBanner } from '../components/PromoBanner'
import { SectionsList } from '../components/SectionsList'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore'
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

  // Pending item waiting for topping selection before being added.
  // Shape: { id, name, price, option, fromRect, flyImageSrc, availableToppings }
  const [pendingToppingItem, setPendingToppingItem] = useState(null)

  // Cart item being edited (to change its toppings).
  // Shape: cartItemId string
  const [editingToppingCartItemId, setEditingToppingCartItemId] = useState(null)

  const { sections, isLoading: sectionsLoading, error: sectionsError } = useSections()
  const { promotion } = usePromotion()
  const cartBtnRef = useRef(null)
  const [isPromoVisible, setIsPromoVisible] = useState(true)

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
      .catch(() => {}) // non-fatal
    return () => { active = false }
  }, [])

  // Derived cart metrics.
  const cartCount = cart.reduce((sum, item) => sum + (item.qty || 0), 0)
  const cartTotal = cart.reduce((sum, item) => {
    const toppingsPrice = (item.selectedToppings || []).reduce(
      (s, t) => s + Number(t.price || 0),
      0
    )
    return sum + (Number(item.price || 0) + toppingsPrice) * (item.qty || 0)
  }, 0)

  const clearCart = () => {
    setCart([])
    setOrderNotes('')
  }

  // Adds a new item or increments an existing one.
  // If the product has available toppings, opens the toppings overlay instead.
  const addToCart = ({
    id,
    name,
    price,
    option = null,
    fromRect = null,
    flyImageSrc = null,
    availableToppings = [],
  }) => {
    if (availableToppings.length > 0) {
      // Park the pending item and show the topping picker.
      setPendingToppingItem({ id, name, price, option, fromRect, flyImageSrc, availableToppings })
      return
    }

    // No toppings — add directly.
    _commitToCart({ id, name, price, option, fromRect, flyImageSrc, selectedToppings: [] })
  }

  // Called when the ToppingsOverlay confirms a selection (add flow).
  const handleToppingConfirmAdd = (selectedToppings) => {
    if (!pendingToppingItem) return
    const { id, name, price, option, fromRect, flyImageSrc, availableToppings } = pendingToppingItem
    _commitToCart({ id, name, price, option, fromRect, flyImageSrc, selectedToppings, availableToppings })
    setPendingToppingItem(null)
  }

  // Writes the resolved item into cart (merges if identical key).
  const _commitToCart = ({ id, name, price, option, fromRect, flyImageSrc, selectedToppings, availableToppings = [] }) => {
    if (fromRect) {
      flyToCart({ fromRect, imgSrc: flyImageSrc, target: cartBtnRef.current })
    }
    setCart((prev) => {
      const toppingIds = selectedToppings.map((t) => t.id)
      const key = getCartKey(id, option, toppingIds)
      const idx = prev.findIndex(
        (it) => getCartKey(it.id, it.option, (it.selectedToppings || []).map((t) => t.id)) === key
      )

      if (idx === -1) {
        return [
          ...prev,
          {
            cartItemId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            id,
            name,
            price,
            option,
            qty: 1,
            selectedToppings,
            availableToppings,
          },
        ]
      }

      const next = [...prev]
      next[idx] = { ...next[idx], qty: (next[idx].qty || 0) + 1 }
      return next
    })
  }

  // Called when the ToppingsOverlay confirms a selection (edit flow).
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

  // Adjust quantity by delta; removes the item when it hits 0.
  // Uses cartItemId for precise targeting (supports multiple items with same product).
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

  // Builds the WhatsApp order summary.
  const buildOrderMessage = () => {
    const notes = orderNotes.trim()
    const lines = [
      'Pedido BK Menu',
      '',
      'Items:',
      ...cart.map((item, idx) => {
        const optionText = item.option ? ` (${item.option})` : ''
        const toppingsText =
          item.selectedToppings?.length
            ? ` [${item.selectedToppings.map((t) => t.name).join(', ')}]`
            : ''
        const toppingsPrice = (item.selectedToppings || []).reduce(
          (s, t) => s + Number(t.price || 0),
          0
        )
        const unitTotal = Number(item.price || 0) + toppingsPrice
        const lineTotal = unitTotal * (item.qty || 0)
        return `${idx + 1}. ${item.qty} x ${item.name}${optionText}${toppingsText} - ${formatMoney(lineTotal)}`
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
      const orderId = `BK-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`
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

  // Scroll reveal for sections.
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
    if (promotion) {
      setIsPromoVisible(true)
    }
  }, [promotion?.id])

  // Derived data for the active edit overlay
  const editingCartItem = editingToppingCartItemId
    ? cart.find((it) => it.cartItemId === editingToppingCartItemId)
    : null

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
          0% { transform: scale(1); }
          35% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>

      <PromoCarousel onAddToCart={addToCart} />

      <div className="mb-50">
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

      {/* Toppings overlay — add flow */}
      <ToppingsOverlay
        isOpen={Boolean(pendingToppingItem)}
        onClose={() => setPendingToppingItem(null)}
        productName={pendingToppingItem?.name ?? ''}
        productPrice={pendingToppingItem?.price ?? 0}
        toppings={pendingToppingItem?.availableToppings ?? []}
        initialSelected={[]}
        onConfirm={handleToppingConfirmAdd}
        confirmLabel="Agregar al carrito"
      />

      {/* Toppings overlay — edit flow */}
      <ToppingsOverlay
        isOpen={Boolean(editingToppingCartItemId)}
        onClose={() => setEditingToppingCartItemId(null)}
        productName={editingCartItem?.name ?? ''}
        productPrice={editingCartItem?.price ?? 0}
        toppings={editingCartItem?.availableToppings ?? []}
        initialSelected={editingCartItem?.selectedToppings ?? []}
        onConfirm={handleToppingConfirmEdit}
        confirmLabel="Guardar cambios"
      />
    </>
  )
}
