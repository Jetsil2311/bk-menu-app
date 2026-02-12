import { useEffect, useState } from 'react'
import { formatMoney } from '../utils/cart'

// Fullscreen cart overlay with order summary and confirmation flow.
export const CartOverlay = ({
  isOpen,
  onClose,
  cart,
  cartCount,
  cartTotal,
  orderNotes,
  setOrderNotes,
  onChangeQty,
  onOrder,
  onClearCart,
}) => {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)

  // Lock body scroll and allow Escape to close when the overlay is open.
  useEffect(() => {
    if (!isOpen) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  const handleClear = () => {
    onClearCart()
    setIsClearConfirmOpen(false)
  }

  return (
    <>
      <div
        className={
          'fixed inset-0 z-[60] ' + (isOpen ? 'pointer-events-auto' : 'pointer-events-none')
        }
        aria-hidden={!isOpen}
        onClick={onClose}
      >
        {/* Expanding circle background */}
        <div
          className={
            'fixed bottom-4 right-4 h-14 w-14 rounded-full bg-main-700 transition-transform duration-500 ease-in-out ' +
            (isOpen ? 'scale-[50]' : 'scale-0')
          }
        />

        {/* Content (stop propagation so clicking inside doesn't close) */}
        <div
          className={
            'fixed inset-0 flex flex-col items-center justify-center gap-4 px-8 transition-opacity duration-300 ' +
            (isOpen ? 'opacity-100' : 'opacity-0')
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
                          {formatMoney(Number(item.price || 0) * (item.qty || 0))}
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full bg-black/20 px-2 py-1">
                          <button
                            type="button"
                            onClick={() => onChangeQty(item.id, item.option, -1)}
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
                            onClick={() => onChangeQty(item.id, item.option, 1)}
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

                <label className="mt-4 block text-sm text-light-200/80">
                  Notas para tu pedido
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={3}
                    maxLength={240}
                    placeholder="Ej. sin cebolla, salsa aparte..."
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-light-100 placeholder:text-light-200/40 focus:outline-none focus:ring-2 focus:ring-light-400/40"
                  />
                  <span className="mt-1 block text-xs text-light-200/50">
                    {orderNotes.length}/240
                  </span>
                </label>

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                  <span className="text-light-200/80">Total a pagar</span>
                  <span className="text-base font-semibold text-light-100">
                    {formatMoney(cartTotal)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onOrder}
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
            onClick={onClose}
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
                onClick={handleClear}
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
