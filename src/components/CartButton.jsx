import { forwardRef } from 'react'
import PropTypes from 'prop-types'
import { formatMoney } from '../utils/cart'

// Cart toggle button.
// Mobile: full-width sticky bottom bar with item count and total.
// Desktop: floating action button (FAB).
// The forwarded ref always points to a positioned div for flyToCart animation targeting.
export const CartButton = forwardRef(function CartButton(
  { isOpen, count, onClick, total = 0 },
  ref
) {
  return (
    <>
      {/* flyToCart animation anchor — always in DOM, positioned at cart location.
          opacity-0 so it's invisible; still has layout for getBoundingClientRect(). */}
      <div
        ref={ref}
        className="fixed bottom-4 right-4 z-[69] w-14 h-14 opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Mobile: sticky bottom bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[70] px-4 pt-2 pb-safe bg-main-950/95 backdrop-blur-sm border-t border-white/10">
        <button
          type="button"
          onClick={onClick}
          className="w-full flex items-center justify-between rounded-xl bg-main-600 px-5 py-3 text-light-200 min-h-[52px] transition hover:bg-main-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-light-400/60 cursor-pointer"
          aria-label={isOpen ? 'Cerrar carrito' : 'Abrir carrito'}
          aria-expanded={isOpen}
        >
          <span className="flex items-center gap-2.5">
            <i className="fas fa-cart-shopping" aria-hidden="true" />
            <span className="text-sm font-medium">
              {count > 0 ? `${count} artículo${count === 1 ? '' : 's'}` : 'Mi carrito'}
            </span>
          </span>
          <span className="flex items-center gap-2">
            {count > 0 && (
              <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
                {count}
              </span>
            )}
            {total > 0 && (
              <span className="text-sm font-semibold text-light-400">
                {formatMoney(total)}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Desktop: floating action button */}
      <button
        type="button"
        onClick={onClick}
        className="hidden sm:inline-flex fixed bottom-4 right-4 z-[70] h-14 w-14 items-center justify-center rounded-full bg-main-600 text-light-200 shadow-2xl transition hover:bg-main-700 hover:text-light-400 focus:outline-none focus:ring-2 focus:ring-light-400/60 cursor-pointer"
        aria-label={isOpen ? 'Cerrar carrito' : 'Abrir carrito'}
        aria-expanded={isOpen}
      >
        <i className={isOpen ? 'fas fa-xmark fa-xl' : 'fas fa-cart-shopping fa-xl'} aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shadow-lg">
            {count}
          </span>
        )}
      </button>
    </>
  )
})

CartButton.propTypes = {
  isOpen: PropTypes.bool,
  count: PropTypes.number,
  onClick: PropTypes.func.isRequired,
  total: PropTypes.number,
}
