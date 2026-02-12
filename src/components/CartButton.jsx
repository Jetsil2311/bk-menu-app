import { forwardRef } from 'react'

// Floating cart toggle button with badge.
export const CartButton = forwardRef(function CartButton(
  { isOpen, count, onClick },
  ref
) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      className="fixed bottom-4 right-4 z-[70] inline-flex h-14 w-14 items-center justify-center rounded-full bg-main-600 text-light-200 shadow-2xl transition hover:bg-main-700 hover:text-light-400 focus:outline-none focus:ring-2 focus:ring-light-400/60"
      aria-label={isOpen ? 'Cerrar carrito' : 'Abrir carrito'}
      aria-expanded={isOpen}
    >
      <i className={isOpen ? 'fas fa-xmark fa-xl' : 'fas fa-cart-shopping fa-xl'} />

      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shadow-lg">
          {count}
        </span>
      )}
    </button>
  )
})
