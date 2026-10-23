import { forwardRef } from 'react'
import PropTypes from 'prop-types'
import { ShoppingBag, X } from 'lucide-react'
import { formatMoney } from '../utils/cart'

// Cart toggle button.
// Mobile: floating rounded pill with item count and total.
// Desktop: floating pill (total + bag bubble).
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
        className="fixed bottom-5 left-5 sm:left-auto sm:right-5 z-[69] w-14 h-14 opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Mobile: floating pill */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-[70] px-3 pb-safe pointer-events-none">
        <button
          type="button"
          onClick={onClick}
          className={`pointer-events-auto w-full flex items-center justify-between gap-3 rounded-full py-2 pl-2 pr-5 min-h-[60px] shadow-[0_14px_30px_-10px_var(--color-ink)] transition-all duration-300 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer ${count > 0 ? 'bg-ink text-surface' : 'bg-surface text-ink ring-1 ring-primary/10'
            }`}
          aria-label={isOpen ? 'Cerrar carrito' : `Abrir carrito, ${count} artículo${count === 1 ? '' : 's'}`}
          aria-expanded={isOpen}
        >
          <span className="flex items-center gap-3">
            <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-surface">
              <ShoppingBag size={20} strokeWidth={2.25} aria-hidden="true" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-accent text-ink text-xs font-extrabold flex items-center justify-center ring-2 ring-ink">
                  {count}
                </span>
              )}
            </span>
            <span className="text-left leading-tight">
              <span className="block font-display text-base font-semibold">
                {count > 0 ? 'Ver mi pedido' : 'Tu pedido está vacío'}
              </span>
              {count === 0 && (
                <span className="block text-xs text-ink-soft">Toca un producto para empezar</span>
              )}
            </span>
          </span>
          {total > 0 && (
            <span className="font-display text-lg font-semibold text-accent tabular-nums">
              {formatMoney(total)}
            </span>
          )}
        </button>
      </div>

      {/* Desktop: floating pill / bubble */}
      <button
        type="button"
        onClick={onClick}
        className="hidden sm:inline-flex fixed bottom-5 right-5 z-[86] h-16 items-center gap-3 rounded-full bg-ink pl-2 pr-2 text-surface shadow-[0_14px_30px_-10px_var(--color-ink)] transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
        aria-label={isOpen ? 'Cerrar carrito' : `Abrir carrito, ${count} artículo${count === 1 ? '' : 's'}`}
        aria-expanded={isOpen}
      >
        {total > 0 && (
          <span className="pl-4 font-display text-lg font-semibold text-accent tabular-nums">
            {formatMoney(total)}
          </span>
        )}
        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary">
          {isOpen
            ? <X size={22} strokeWidth={2.5} aria-hidden="true" />
            : <ShoppingBag size={22} strokeWidth={2.25} aria-hidden="true" />}
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-accent text-ink text-xs font-extrabold flex items-center justify-center ring-2 ring-ink">
              {count}
            </span>
          )}
        </span>
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
