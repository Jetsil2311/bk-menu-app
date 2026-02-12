import React, { useEffect, useRef, useState } from 'react'
import Logo from '../assets/bklogo.svg'
import { useLocation } from 'react-router'
import { Navbar } from '../components/Navbar'
import Banner from '../assets/Banner.jpeg'
import { CartButton } from '../components/CartButton'
import { CartOverlay } from '../components/CartOverlay'
import { PromoBanner } from '../components/PromoBanner'
import { SectionsList } from '../components/SectionsList'
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore'
import { usePromotion } from '../hooks/usePromotion'
import { useSections } from '../hooks/useSections'
import { flyToCart, formatMoney, getCartKey } from '../utils/cart'
import { db } from '../firebase'

export const Home = () => {
  const location = useLocation()
  // Phone number used to generate WhatsApp order links.
  const WHATSAPP_NUMBER = '5574182443'

  // Cart + overlay state.
  const [cart, setCart] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')
  // Sections are fetched from Firestore via a dedicated hook.
  const { sections, isLoading: sectionsLoading, error: sectionsError } = useSections()
  const { promotion } = usePromotion()
  // Ref used by the "fly to cart" animation.
  const cartBtnRef = useRef(null)
  const [isPromoVisible, setIsPromoVisible] = useState(true)

  // Derived cart metrics used in multiple UI spots.
  const cartCount = cart.reduce((sum, item) => sum + (item.qty || 0), 0)
  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * (item.qty || 0),
    0
  )

  // Resets the cart + notes.
  const clearCart = () => {
    setCart([])
    setOrderNotes('')
  }

  // Adds a new item or increments an existing one.
  const addToCart = ({
    id,
    name,
    price,
    option = null,
    fromRect = null,
    flyImageSrc = null,
  }) => {
    if (fromRect) {
      flyToCart({ fromRect, imgSrc: flyImageSrc, target: cartBtnRef.current })
    }
    setCart((prev) => {
      const key = getCartKey(id, option)
      const idx = prev.findIndex((it) => getCartKey(it.id, it.option) === key)

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
          },
        ]
      }

      const next = [...prev]
      next[idx] = { ...next[idx], qty: (next[idx].qty || 0) + 1 }
      return next
    })
  }

  // Adjust quantity by delta; removes the item when it hits 0.
  const changeQty = (id, option, delta) => {
    setCart((prev) => {
      const key = getCartKey(id, option)
      const idx = prev.findIndex((it) => getCartKey(it.id, it.option) === key)
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
        const unit = Number(item.price || 0)
        const qty = item.qty || 0
        const lineTotal = unit * qty
        return `${idx + 1}. ${qty} x ${item.name}${optionText} - ${formatMoney(
          lineTotal
        )}`
      }),
      '',
      `Total: ${formatMoney(cartTotal)}`,
    ]

    if (notes) {
      lines.push('', `Notas: ${notes}`)
    }

    return lines.join('\n')
  }

  // Sends the order via WhatsApp.
  const handleWhatsAppOrder = () => {
    if (cart.length === 0) return
    const message = buildOrderMessage()
    saveOrderSnapshot(message, cartTotal)
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      message
    )}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Stores the order text in Firestore and keeps only the latest 50.
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

  // Reset promo visibility when a new promotion arrives.
  useEffect(() => {
    if (promotion) {
      setIsPromoVisible(true)
    }
  }, [promotion?.id])

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

      <div className="relative w-full h-80 sm:h-112 lg:h-[600px] overflow-hidden shadow-2xl shadow-black/30">
        {/* blurred layer */}
        <img
          src={Banner}
          alt="Banner"
          className="absolute inset-0 w-full h-full object-cover brightness-45 blur-sm scale-110"
        />

        {/* inner bottom shadow for text */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Small screens: centered. sm+: bottom-left */}
        <div className="relative z-10 flex h-full w-full items-center justify-center sm:items-end sm:justify-start pl-0 sm:pl-20 pb-0 sm:pb-20">
          <img src={Logo} alt="BK Logo" className="h-20 sm:h-30" />
        </div>
      </div>

      {/* Sections list */}
      <div className="mb-50">
        <SectionsList
          isLoading={sectionsLoading}
          error={sectionsError}
          sections={sections}
          pathname={location.pathname}
          onAddToCart={addToCart}
        />
      </div>

      {/* Floating cart button (all screen sizes) */}
      <CartButton
        ref={cartBtnRef}
        isOpen={isCartOpen}
        count={cartCount}
        onClick={() => setIsCartOpen((v) => !v)}
      />

      {/* Cart overlay (separate component to keep Home lean). */}
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
      />
    </>
  )
}
