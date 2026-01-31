import React, { useEffect, useState } from 'react'
import Logo from '../assets/bklogo.svg'
import { useLocation } from 'react-router'
import { Navbar } from '../components/Navbar'
import Banner from '../assets/Banner.jpeg'
import { MenuSection } from '../components/MenuSection'
import { sections } from '../assets/sections.js'

export const Home = () => {
  const location = useLocation()
  const WHATSAPP_NUMBER = '7207487599'

  const [cart, setCart] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)

  const cartCount = cart.reduce((sum, item) => sum + (item.qty || 0), 0)
  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * (item.qty || 0),
    0
  )

  const formatMoney = (value) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 2,
    }).format(value)

  const getCartKey = (id, option) => `${id}::${option ?? ''}`
  const clearCart = () => {
    setCart([])
    setIsClearConfirmOpen(false)
  }

  const addToCart = ({ id, name, price, option = null }) => {
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

  const buildOrderMessage = () => {
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

    return lines.join('\n')
  }

  const handleWhatsAppOrder = () => {
    if (cart.length === 0) return
    const message = buildOrderMessage()
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      message
    )}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Scroll reveal
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
  }, [location.pathname])

  // Cart overlay: lock scroll + Esc to close
  useEffect(() => {
    if (!isCartOpen) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsCartOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isCartOpen])

  return (
    <>
      <Navbar />

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

      {/* Sections */}
      <div className="mb-50">
        {sections.map((section, idx) =>
          (`/${section.category.toLowerCase()}` === location.pathname || location.pathname === '/') ? (
            <div
              key={section.id}
              data-reveal
              style={{ transitionDelay: `${Math.min(idx * 60, 240)}ms` }}
              className="opacity-0 translate-y-6 transition-all duration-700 ease-out will-change-transform"
            >
              <MenuSection desc={section.desc} onAddToCart={addToCart}>
                {section.name}
              </MenuSection>
            </div>
          ) : null
        )}
      </div>

      {/* Floating cart button (all screen sizes) */}
      <button
        type="button"
        onClick={() => setIsCartOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-[70] inline-flex h-14 w-14 items-center justify-center rounded-full bg-main-600 text-light-200 shadow-2xl transition hover:bg-main-700 hover:text-light-400 focus:outline-none focus:ring-2 focus:ring-light-400/60"
        aria-label={isCartOpen ? 'Cerrar carrito' : 'Abrir carrito'}
        aria-expanded={isCartOpen}
      >
        <i className={isCartOpen ? 'fas fa-xmark fa-xl' : 'fas fa-cart-shopping fa-xl'} />

        {/* Badge */}
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shadow-lg">
            {cartCount}
          </span>
        )}
      </button>

      {/* Cart bubble overlay (independent from navbar/burger) */}
      <div
        className={
          'fixed inset-0 z-[60] ' +
          (isCartOpen ? 'pointer-events-auto' : 'pointer-events-none')
        }
        aria-hidden={!isCartOpen}
        onClick={() => setIsCartOpen(false)}
      >
        {/* Expanding circle background */}
        <div
          className={
            'fixed bottom-4 right-4 h-14 w-14 rounded-full bg-main-700 transition-transform duration-500 ease-in-out ' +
            (isCartOpen ? 'scale-[50]' : 'scale-0')
          }
        />

        {/* Content (stop propagation so clicking inside doesn't close) */}
        <div
          className={
            'fixed inset-0 flex flex-col items-center justify-center gap-4 px-8 transition-opacity duration-300 ' +
            (isCartOpen ? 'opacity-100' : 'opacity-0')
          }
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-light-200">Tu carrito</div>
            <div className="mt-2 text-sm text-light-200/70">
              {cartCount > 0
                ? `Tienes ${cartCount} artículo${cartCount === 1 ? '' : 's'}.`
                : 'Aún no agregas productos.'}
            </div>
          </div>

          <div className="mt-4 w-full max-w-md rounded-2xl bg-white/10 p-5 text-light-200">
            {cartCount === 0 ? (
              <div className="text-sm text-light-200/80">🧺 Carrito vacío</div>
            ) : (
              <>
                <ul className="max-h-64 overflow-auto pr-1 space-y-3">
                  {cart.map((item) => (
                    <li
                      key={item.cartItemId}
                      className="flex items-start justify-between gap-3 rounded-xl bg-white/10 p-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-light-100">
                          {item.name}
                        </div>
                        {item.option && (
                          <div className="mt-1 text-xs text-light-200/70">
                            {item.option}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-light-200/70">
                          {formatMoney(Number(item.price || 0))} c/u
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-sm font-semibold text-light-100">
                          {formatMoney(
                            Number(item.price || 0) * (item.qty || 0)
                          )}
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full bg-black/20 px-2 py-1">
                          <button
                            type="button"
                            onClick={() => changeQty(item.id, item.option, -1)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-light-200 hover:bg-white/20"
                            aria-label={`Quitar ${item.name}`}
                          >
                            -
                          </button>
                          <span className="text-sm font-semibold text-light-100 min-w-[18px] text-center">
                            {item.qty || 0}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeQty(item.id, item.option, 1)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-light-200 hover:bg-white/20"
                            aria-label={`Agregar ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                  <span className="text-light-200/80">Total a pagar</span>
                  <span className="text-base font-semibold text-light-100">
                    {formatMoney(cartTotal)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleWhatsAppOrder}
                  disabled={cartCount === 0}
                  className="mt-4 w-full rounded-xl bg-main-700 px-4 py-2 text-sm font-semibold text-light-100 transition hover:bg-main-800"
                >
                  Realizar pedido
                </button>

                <button
                  type="button"
                  onClick={() => setIsClearConfirmOpen(true)}
                  className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-light-100 transition hover:bg-white/20"
                >
                  Limpiar carrito
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="mt-2 text-sm text-light-200/70 underline underline-offset-4 hover:text-light-200"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Clear cart confirmation */}
      {isClearConfirmOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar limpiar carrito"
          onClick={() => setIsClearConfirmOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />

          <div
            className="relative w-full max-w-sm rounded-2xl bg-light-200 p-6 text-main-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold">¿Limpiar carrito?</div>
            <p className="mt-2 text-sm text-main-600">
              Se eliminarán todos los productos agregados.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="rounded-lg border border-main-300 px-3 py-2 text-sm text-main-700 hover:bg-main-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={clearCart}
                className="rounded-lg bg-main-700 px-3 py-2 text-sm font-semibold text-light-100 hover:bg-main-800"
              >
                Sí, limpiar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
