import { useEffect, useState } from 'react'
import { formatMoney } from '../utils/cart'

// Modal overlay for selecting toppings before adding to cart (or editing from cart).
// Props:
//   isOpen          — controls visibility
//   onClose         — called when user dismisses without confirming
//   productName     — shown in the header
//   productPrice    — base price (number) shown + used for total preview
//   toppings        — [{id, name, price}] all available toppings for this product
//   initialSelected — [{id, name, price}] pre-selected toppings (edit mode)
//   onConfirm       — (selectedToppings: [{id, name, price}]) => void
//   confirmLabel    — button label, defaults to "Agregar al carrito"
export const ToppingsOverlay = ({
  isOpen,
  onClose,
  productName = '',
  productPrice = 0,
  toppings = [],
  initialSelected = [],
  onConfirm,
  confirmLabel = 'Agregar al carrito',
}) => {
  const [selectedIds, setSelectedIds] = useState([])

  // Sync pre-selection whenever the overlay opens.
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelected.map((t) => t.id))
    }
  }, [isOpen])

  // Escape key closes.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const toggle = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )

  const selectedToppings = toppings.filter((t) => selectedIds.includes(t.id))
  const toppingsTotal = selectedToppings.reduce((s, t) => s + Number(t.price || 0), 0)

  const handleConfirm = () => {
    onConfirm?.(selectedToppings)
    onClose()
  }

  return (
    <div
      className={
        'fixed inset-0 z-[95] flex items-center justify-center px-6 transition-opacity duration-200 ' +
        (isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')
      }
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* panel */}
      <div
        className={
          'relative w-full max-w-sm rounded-2xl bg-light-200 p-6 text-main-800 shadow-2xl transition-all duration-200 ' +
          (isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0')
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <h3 className="text-lg font-semibold leading-tight">{productName}</h3>
        <p className="mt-1 text-sm text-main-600">
          Precio base: {formatMoney(Number(productPrice))}
        </p>

        {toppings.length === 0 ? (
          <p className="mt-4 text-sm text-main-500">Sin toppings disponibles.</p>
        ) : (
          <>
            <p className="mt-4 text-sm font-medium text-main-700">
              Elige tus extras:
            </p>

            <ul className="mt-3 max-h-60 space-y-2 overflow-auto pr-1">
              {toppings.map((topping) => {
                const checked = selectedIds.includes(topping.id)
                return (
                  <li key={topping.id}>
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-main-200 bg-white px-4 py-3 transition hover:bg-light-100">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(topping.id)}
                          className="h-4 w-4 accent-main-700"
                        />
                        <span className="text-sm font-medium">{topping.name}</span>
                      </div>
                      <span className="shrink-0 text-sm text-main-600">
                        +{formatMoney(Number(topping.price || 0))}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            {/* total preview */}
            <div className="mt-4 flex items-center justify-between border-t border-main-200 pt-4 text-sm">
              <span className="text-main-600">Total estimado</span>
              <span className="font-semibold text-main-800">
                {formatMoney(Number(productPrice) + toppingsTotal)}
              </span>
            </div>
          </>
        )}

        {/* actions */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-main-300 px-4 py-2 text-sm text-main-700 transition hover:bg-main-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-xl bg-main-700 px-4 py-2 text-sm font-semibold text-light-100 transition hover:bg-main-800"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
