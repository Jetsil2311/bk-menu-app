import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Check, Coffee, Info, Plus, SlidersHorizontal, Star } from 'lucide-react'
import { getSectionTone } from '../utils/menuTheme'

const BASE_URL = import.meta.env.BASE_URL

export const MenuCard = ({
  name,
  long_desc,
  desc,
  price,
  image,
  imageUrl,
  id,
  isActive = true,
  availableToppings = [],
  optionGroups = [],
  featured = false,
  popular = false,
  onAddToCart,
  tone = getSectionTone(0),
}) => {
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const addedTimerRef = useRef(null)
  const wrapperRef = useRef(null)
  const imgRef = useRef(null)
  const cardInstanceId = useRef(
    `card-${id}-${Math.random().toString(36).slice(2)}`
  )

  // Close info popover on outside click or when another card opens
  useEffect(() => {
    const handlePointerDown = (e) => {
      if (!isInfoOpen) return
      const menuEl = e.target.closest?.(
        '[data-menu="popover"], [data-menu-btn]'
      )
      if (menuEl) return
      setIsInfoOpen(false)
    }

    const handleGlobalOpen = (e) => {
      if (
        e?.detail?.sourceId &&
        e.detail.sourceId !== cardInstanceId.current
      ) {
        setIsInfoOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('bk-menu:open', handleGlobalOpen)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('bk-menu:open', handleGlobalOpen)
    }
  }, [isInfoOpen])

  // Close info popover on scroll or Escape
  useEffect(() => {
    if (!isInfoOpen) return

    const closeInfo = () => setIsInfoOpen(false)
    const handleEsc = (e) => {
      if (e.key === 'Escape') closeInfo()
    }

    window.addEventListener('scroll', closeInfo, { passive: true, capture: true })
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('scroll', closeInfo, { capture: true })
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isInfoOpen])

  useEffect(() => () => clearTimeout(addedTimerRef.current), [])

  const isDisabled = isActive === false
  const showBadge = featured || popular
  const hasOptions =
    (Array.isArray(optionGroups) && optionGroups.length > 0)
  const extraToppings =
    availableToppings.length > 1 ? availableToppings.length - 1 : 0

  const handleAddClick = (e) => {
    if (isDisabled) return
    const rect =
      imgRef.current?.getBoundingClientRect?.() ??
      e.currentTarget.getBoundingClientRect()
    const src =
      imgRef.current?.currentSrc || imgRef.current?.src || null
    onAddToCart?.({
      id,
      name,
      price,
      desc,
      long_desc,
      image,
      imageUrl,
      fromRect: rect,
      flyImageSrc: src,
      availableToppings,
      optionGroups,
    })
    // Flash checkmark only for direct-add (no overlay will open)
    if (!hasOptions && availableToppings.length === 0) {
      clearTimeout(addedTimerRef.current)
      setAdded(true)
      addedTimerRef.current = setTimeout(() => setAdded(false), 700)
    }
  }

  // Short, plain-language hint of what can be customized on this product.
  const customizeHint = hasOptions
    ? optionGroups.slice(0, 2).map((g) => g.name).filter(Boolean).join(' · ') || 'Opciones'
    : availableToppings.length > 0
    ? `${availableToppings[0].name} +$${availableToppings[0].price}${extraToppings > 0 ? ` · +${extraToppings}` : ''}`
    : ''
  const extraGroups = hasOptions && optionGroups.length > 2 ? optionGroups.length - 2 : 0

  return (
    <li
      ref={wrapperRef}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={`${name}, $${price}${hasOptions ? ', personalizable' : ''}`}
      onClick={handleAddClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAddClick(e) }
      }}
      className={`group relative flex sm:flex-col gap-3 sm:gap-0 rounded-[1.75rem] bg-surface p-2.5 sm:p-3 shadow-[0_10px_30px_-18px_var(--color-ink)] ring-1 transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        isInfoOpen ? 'z-999' : 'z-0'
      } ${isDisabled
        ? 'opacity-60 cursor-not-allowed ring-primary/5'
        : 'cursor-pointer active:scale-[0.98] sm:hover:-translate-y-1.5 sm:hover:shadow-[0_22px_40px_-20px_var(--color-ink)]'
      } ${added ? 'ring-2 ring-primary/50 scale-[1.02]' : 'ring-primary/5'}`}
    >
      {/* ── Image: squircle on mobile, inset rounded photo on desktop ──── */}
      <div className={`relative h-28 w-28 sm:h-auto sm:w-full shrink-0 overflow-hidden rounded-[1.4rem] sm:aspect-[4/3] ${tone.bg}`}>
        {imgFailed ? (
          <div className={`flex h-full w-full items-center justify-center ${tone.ink}`} aria-hidden="true">
            <Coffee size={36} strokeWidth={1.75} />
          </div>
        ) : (
          <img
            ref={imgRef}
            src={imageUrl || `${BASE_URL}products/${id}${image ?? ''}`}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out sm:group-hover:scale-105"
            onError={() => setImgFailed(true)}
          />
        )}

        {/* Popular sticker */}
        {showBadge && (
          <span className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 -rotate-6 inline-flex items-center gap-1 rounded-full bg-mango px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide text-mango-ink shadow-[0_4px_10px_-4px_var(--color-ink)]">
            <Star size={11} strokeWidth={0} fill="currentColor" aria-hidden="true" />
            Popular
          </span>
        )}

        {/* Agotado sticker */}
        {isDisabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
            <span className="rotate-[-8deg] rounded-full bg-surface px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-primary shadow">
              Agotado
            </span>
          </div>
        )}

        {/* Added confirmation flash */}
        {added && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-primary/35 pointer-events-none"
            style={{ animation: 'cardCheckIn 0.65s ease-out forwards' }}
          >
            <Check size={44} strokeWidth={3} className="text-surface drop-shadow-lg" aria-hidden="true" />
          </div>
        )}
      </div>
      <style>{`@keyframes cardCheckIn{0%{opacity:0;transform:scale(0.6)}40%{opacity:1;transform:scale(1.08)}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}`}</style>

      {/* ── Card body ──────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col py-1 pr-1 sm:px-2 sm:pt-3 sm:pb-1">

        {/* 1. Product name */}
        <h3 className="font-display text-lg sm:text-xl font-semibold leading-tight text-ink line-clamp-2">
          {name}
        </h3>

        {/* 2. Short description */}
        {desc && (
          <p className="mt-0.5 text-[0.85rem] sm:text-sm text-ink-soft line-clamp-1 sm:line-clamp-2 leading-snug">
            {desc}
          </p>
        )}

        {/* 3. Customization hint */}
        {customizeHint && (
          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            <span className={`inline-flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.bg} ${tone.ink}`}>
              {hasOptions
                ? <SlidersHorizontal size={12} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
                : <Plus size={12} strokeWidth={3} className="shrink-0" aria-hidden="true" />}
              <span className="truncate">{hasOptions ? `Elige ${customizeHint}` : customizeHint}</span>
            </span>
            {extraGroups > 0 && (
              <span className="shrink-0 text-[11px] font-bold text-ink-soft">+{extraGroups}</span>
            )}
          </div>
        )}

        {/* 4. Price + actions row — pinned to bottom */}
        <div className="mt-auto pt-2 sm:pt-4 flex items-center justify-between gap-2">

          {/* Price */}
          <span className="font-display text-xl sm:text-2xl font-semibold text-primary tabular-nums">
            <span className="text-sm sm:text-base align-top mr-0.5">$</span>{price}
          </span>

          {/* Info button + add bubble */}
          <div className="flex items-center gap-1">

            {/* Info button */}
            {long_desc && (
              <div className="relative">
                <button
                  type="button"
                  data-menu-btn
                  onClick={(e) => {
                    e.stopPropagation()
                    document.dispatchEvent(
                      new CustomEvent('bk-menu:open', {
                        detail: { sourceId: cardInstanceId.current },
                      })
                    )
                    setIsInfoOpen((v) => !v)
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft/70 transition-colors duration-200 hover:bg-bg hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer"
                  aria-label={`Más información de ${name}`}
                  aria-expanded={isInfoOpen}
                >
                  <Info size={18} strokeWidth={2.25} aria-hidden="true" />
                </button>

                {isInfoOpen && (
                  <div
                    data-menu="popover"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full right-0 mb-2 z-[1000] w-72 max-w-[80vw] rounded-3xl rounded-br-md bg-ink p-4 text-sm text-surface shadow-xl"
                  >
                    <p className="whitespace-pre-line leading-relaxed text-surface/90">
                      {long_desc}
                    </p>
                    <div className="mt-2.5 text-xs text-accent/80">
                      Toca afuera para cerrar
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Visual add bubble — the whole card is the tap target */}
            <span
              aria-hidden="true"
              className={`inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-all duration-200 select-none ${
                isDisabled
                  ? 'bg-primary/15 text-primary/50'
                  : added
                  ? 'bg-secondary text-surface scale-110'
                  : 'bg-primary text-surface shadow-[0_6px_14px_-6px_var(--color-primary)] group-hover:rotate-90'
              }`}
            >
              {added
                ? <Check size={20} strokeWidth={3} />
                : <Plus size={22} strokeWidth={2.75} />}
            </span>

          </div>
        </div>
      </div>
    </li>
  )
}

MenuCard.propTypes = {
  name: PropTypes.string.isRequired,
  long_desc: PropTypes.string,
  desc: PropTypes.string,
  price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  image: PropTypes.string,
  imageUrl: PropTypes.string,
  isActive: PropTypes.bool,
  featured: PropTypes.bool,
  popular: PropTypes.bool,
  id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  availableToppings: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      price: PropTypes.number,
    })
  ),
  optionGroups: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      type: PropTypes.oneOf(['single', 'multi']),
      required: PropTypes.bool,
      options: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          name: PropTypes.string,
          priceModifier: PropTypes.number,
        })
      ),
    })
  ),
  onAddToCart: PropTypes.func,
  tone: PropTypes.shape({ bg: PropTypes.string, ink: PropTypes.string, ring: PropTypes.string }),
}
