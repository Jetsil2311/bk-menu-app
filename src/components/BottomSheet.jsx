import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

const BASE_URL = import.meta.env.BASE_URL

// SVG check icon for selected option pills
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
  </svg>
)

// ─── BottomSheet ─────────────────────────────────────────────────────────────
// Props:
//   isOpen        — boolean: controls visibility + animation
//   onClose       — called when backdrop tapped, Escape pressed, or swipe-down
//   product       — { id, name, price, desc, long_desc, imageUrl, image,
//                    optionGroups, availableToppings }
//   onConfirm     — ({ selectedOptions, qty }) => void
export const BottomSheet = ({ isOpen, onClose, product, onConfirm }) => {
  const [selections, setSelections] = useState({})
  const [qty, setQty] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragDeltaY, setDragDeltaY] = useState(0)
  // localProduct persists during close animation so content doesn't flash away
  const [localProduct, setLocalProduct] = useState(null)
  const sheetRef = useRef(null)

  // Sync localProduct: set immediately on open, clear after close animation
  useEffect(() => {
    if (product) {
      setLocalProduct(product)
    } else {
      const t = setTimeout(() => setLocalProduct(null), 350)
      return () => clearTimeout(t)
    }
  }, [product])

  // Reset selections and qty whenever a new product opens.
  // Keyed on product?.id so we reset only when a *different* product is opened.
  useEffect(() => {
    if (isOpen && product) {
      setSelections({})
      setQty(1)
      setDragDeltaY(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, product?.id])

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Don't render the portal at all until a product has been set
  if (!localProduct) return null

  const optionGroups = localProduct.optionGroups || []

  const isRequiredComplete = optionGroups
    .filter((g) => g.required)
    .every((g) => (selections[g.id] || []).length > 0)

  const optionsTotal = optionGroups.reduce((sum, g) => {
    const sel = selections[g.id] || []
    return (
      sum +
      (g.options || [])
        .filter((o) => sel.includes(o.id))
        .reduce((s, o) => s + Number(o.priceModifier || 0), 0)
    )
  }, 0)

  const unitTotal = Number(localProduct.price || 0) + optionsTotal
  const grandTotal = unitTotal * qty

  const toggleOption = (group, optId) => {
    setSelections((prev) => {
      const curr = prev[group.id] || []
      if (group.type === 'single') {
        return { ...prev, [group.id]: [optId] }
      }
      // multi-select
      if (curr.includes(optId)) {
        return { ...prev, [group.id]: curr.filter((x) => x !== optId) }
      }
      return { ...prev, [group.id]: [...curr, optId] }
    })
  }

  const buildSelectedOptions = () => {
    const opts = []
    optionGroups.forEach((g) => {
      const sel = selections[g.id] || []
      ;(g.options || [])
        .filter((o) => sel.includes(o.id))
        .forEach((o) => {
          opts.push({
            groupId: g.id,
            groupName: g.name,
            optionId: o.id,
            optionName: o.name,
            priceModifier: Number(o.priceModifier || 0),
          })
        })
    })
    return opts
  }

  const handleConfirm = () => {
    if (!isRequiredComplete) return
    onConfirm({ selectedOptions: buildSelectedOptions(), qty })
  }

  // Touch swipe-to-dismiss (drag handle area + whole sheet top)
  const handleTouchStart = (e) => {
    setIsDragging(true)
    setDragStartY(e.touches[0].clientY)
    setDragDeltaY(0)
  }

  const handleTouchMove = (e) => {
    if (!isDragging) return
    const delta = Math.max(0, e.touches[0].clientY - dragStartY)
    setDragDeltaY(delta)
  }

  const handleTouchEnd = () => {
    if (dragDeltaY > 90) {
      onClose()
    }
    setDragDeltaY(0)
    setIsDragging(false)
  }

  const imgSrc =
    localProduct.imageUrl ||
    (localProduct.id
      ? `${BASE_URL}products/${localProduct.id}${localProduct.image ?? ''}`
      : null)

  const sheetTransform = isOpen
    ? `translateY(${dragDeltaY}px)`
    : 'translateY(100%)'

  const sheetTransition = isDragging
    ? 'none'
    : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)'

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0"
      style={{ zIndex: 9000 }}
      aria-modal={isOpen ? 'true' : 'false'}
      role="dialog"
      aria-label={`Opciones para ${localProduct.name}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 300ms ease',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        ref={sheetRef}
        style={{
          transform: sheetTransform,
          transition: sheetTransition,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-3xl overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Inner container: bg + max-height */}
        <div
          className="flex flex-col w-full rounded-t-3xl overflow-hidden"
          style={{ background: '#1c0d05', maxHeight: '80vh' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2 shrink-0">
            <div
              className="rounded-full bg-white/20"
              style={{ width: 40, height: 4 }}
            />
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Product hero image */}
            {imgSrc && (
              <div className="relative w-full" style={{ height: 180 }}>
                <img
                  src={imgSrc}
                  alt={localProduct.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                {/* Warm gradient overlay at bottom of image */}
                <div
                  className="absolute inset-x-0 bottom-0 pointer-events-none"
                  style={{
                    height: '50%',
                    background: 'linear-gradient(to top, #1c0d05, transparent)',
                  }}
                />
              </div>
            )}

            {/* Product info */}
            <div className="px-5 pt-4 pb-2">
              <h3
                className="font-bold leading-tight"
                style={{ fontSize: 20, color: '#faf6f0' }}
              >
                {localProduct.name}
              </h3>
              {localProduct.desc && (
                <p
                  className="mt-1 text-sm italic leading-relaxed"
                  style={{ color: '#b09080' }}
                >
                  {localProduct.desc}
                </p>
              )}
              <p
                className="mt-2 font-semibold"
                style={{ fontSize: 18, color: '#c84b2f' }}
              >
                ${Number(localProduct.price).toLocaleString('es-MX')}
              </p>
            </div>

            {/* Option groups */}
            {optionGroups.map((group) => {
              const sel = selections[group.id] || []
              return (
                <div
                  key={group.id}
                  className="px-5 py-4"
                  style={{ borderTop: '1px solid rgba(120,60,20,0.25)' }}
                >
                  {/* Group label row */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#b09080' }}
                    >
                      {group.name}
                    </span>
                    {group.required && (
                      <span
                        className="text-sm font-bold"
                        style={{ color: '#ef4444' }}
                        aria-label="requerido"
                      >
                        *
                      </span>
                    )}
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px]"
                      style={{
                        border: '1px solid rgba(146,84,32,0.4)',
                        color: '#b09080',
                      }}
                    >
                      {group.type === 'single' ? 'Elige 1' : 'Elige varios'}
                    </span>
                  </div>

                  {/* Option pills */}
                  <div className="flex flex-wrap gap-2">
                    {(group.options || []).map((opt) => {
                      const isSelected = sel.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleOption(group, opt.id)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/50"
                          style={
                            isSelected
                              ? {
                                  background: '#7c2d12',
                                  border: '1px solid #7c2d12',
                                  color: '#ffffff',
                                }
                              : {
                                  background: 'transparent',
                                  border: '1px solid rgba(146,84,32,0.5)',
                                  color: '#faf6f0',
                                }
                          }
                          aria-pressed={isSelected}
                        >
                          {isSelected && <CheckIcon />}
                          <span>{opt.name}</span>
                          {Number(opt.priceModifier) > 0 && (
                            <span
                              className="text-xs"
                              style={{ opacity: 0.8 }}
                            >
                              +${opt.priceModifier}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Quantity selector */}
            <div
              className="px-5 py-4 flex items-center justify-center gap-6"
              style={{ borderTop: '1px solid rgba(120,60,20,0.25)' }}
            >
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="h-9 w-9 flex items-center justify-center rounded-full text-xl font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/50"
                style={
                  qty <= 1
                    ? {
                        border: '1px solid rgba(120,60,20,0.2)',
                        color: 'rgba(120,60,20,0.3)',
                        cursor: 'not-allowed',
                      }
                    : {
                        border: '1px solid rgba(146,84,32,0.5)',
                        color: '#faf6f0',
                        cursor: 'pointer',
                      }
                }
                aria-label="Disminuir cantidad"
              >
                −
              </button>
              <span
                className="font-semibold text-lg min-w-[24px] text-center select-none"
                style={{ color: '#faf6f0' }}
              >
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="h-9 w-9 flex items-center justify-center rounded-full text-xl font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/50"
                style={{
                  border: '1px solid rgba(146,84,32,0.5)',
                  color: '#faf6f0',
                }}
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>

            {/* Spacer so content clears the sticky bar */}
            <div style={{ height: 96 }} />
          </div>

          {/* Sticky bottom bar */}
          <div
            className="shrink-0 px-5 py-4"
            style={{
              borderTop: '1px solid rgba(120,60,20,0.3)',
              background: '#0f0602',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
            }}
          >
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isRequiredComplete}
              className="w-full rounded-2xl py-4 text-base font-bold text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/50"
              style={
                isRequiredComplete
                  ? { background: '#7c2d12', cursor: 'pointer' }
                  : {
                      background: '#3a1810',
                      color: '#6b5c52',
                      cursor: 'not-allowed',
                    }
              }
              onMouseEnter={(e) => {
                if (isRequiredComplete)
                  e.currentTarget.style.background = '#9a3a17'
              }}
              onMouseLeave={(e) => {
                if (isRequiredComplete)
                  e.currentTarget.style.background = '#7c2d12'
              }}
            >
              Agregar&nbsp;·&nbsp;$
              {Number(grandTotal).toLocaleString('es-MX')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

BottomSheet.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  product: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    name: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    desc: PropTypes.string,
    long_desc: PropTypes.string,
    imageUrl: PropTypes.string,
    image: PropTypes.string,
    optionGroups: PropTypes.array,
    availableToppings: PropTypes.array,
  }),
  onConfirm: PropTypes.func.isRequired,
}
