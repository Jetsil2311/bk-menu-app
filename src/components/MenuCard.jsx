import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

const BASE_URL = import.meta.env.BASE_URL

// ─── SVG icons (no emojis as icons per design system) ────────────────────────
const InfoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="w-4 h-4"
  >
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
      clipRule="evenodd"
    />
  </svg>
)

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
}) => {
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [added, setAdded] = useState(false)
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

  return (
    <li
      ref={wrapperRef}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onClick={handleAddClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAddClick(e) }
      }}
      className={`relative overflow-visible flex flex-col rounded-2xl border bg-light-100 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer ${
        isInfoOpen ? 'z-999' : 'z-0'
      } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''} ${
        added ? 'border-main-400 ring-2 ring-main-400/40 scale-[1.02]' : 'border-main-100'
      }`}
    >
      {/* ── Image area ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-t-2xl bg-main-200/40">
        <img
          ref={imgRef}
          src={imageUrl || `${BASE_URL}products/${id}${image ?? ''}`}
          alt={name}
          loading="lazy"
          className="w-full aspect-[4/3] object-cover"
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src = 'https://placehold.co/400x400/e2e8f0/94a3b8?text=Producto'
          }}
        />

        {/* Warm gradient at bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(15,22,41,0.15), transparent)',
          }}
        />

        {/* Popular / featured badge */}
        {showBadge && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-main-600/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold text-light-200 shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3 h-3 text-amber-300"
            >
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.872 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
            </svg>
            Popular
          </span>
        )}

        {/* Agotado overlay */}
        {isDisabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-main-950/40 rounded-t-2xl">
            <span className="rounded-full bg-main-800/80 px-3 py-1 text-xs font-semibold text-light-200 shadow">
              Agotado
            </span>
          </div>
        )}

        {/* Added confirmation flash */}
        {added && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-t-2xl pointer-events-none"
            style={{ background: 'rgba(59,91,219,0.30)', animation: 'cardCheckIn 0.65s ease-out forwards' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 drop-shadow-lg">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
      <style>{`@keyframes cardCheckIn{0%{opacity:0;transform:scale(0.6)}40%{opacity:1;transform:scale(1.08)}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}`}</style>

      {/* ── Card body ──────────────────────────────────────────────────── */}
      <div className="flex flex-col px-4 pb-4 pt-3 flex-1">

        {/* 1. Product name */}
        <h4 className="text-base font-semibold text-[#1C1C1E] truncate leading-snug">
          {name}
        </h4>

        {/* 2. Short description */}
        {desc && (
          <p className="mt-1 text-sm italic text-[#6B7280] line-clamp-2 leading-relaxed">
            {desc}
          </p>
        )}

        {/* 3. Option group hint / toppings badge */}
        {(hasOptions || availableToppings.length > 0) && (
          <div className="border-t border-main-100 mt-2.5 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {hasOptions && (
                <span className="inline-flex items-center gap-1 rounded-full border border-main-300/30 bg-main-50 px-2.5 py-0.5 text-[11px] font-medium text-main-600">
                  ✦ {optionGroups[0]?.name ?? 'Opciones'}{' '}
                  {optionGroups.length > 1 && `+${optionGroups.length - 1} más`}
                </span>
              )}
              {!hasOptions && availableToppings.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-main-300/30 bg-main-50 px-2.5 py-0.5 text-[11px] font-medium text-main-600">
                  ✦ Agrega {availableToppings[0].name} +$
                  {availableToppings[0].price}
                </span>
              )}
              {!hasOptions && extraToppings > 0 && (
                <span className="inline-flex items-center rounded-full border border-main-200/40 bg-main-50 px-2 py-0.5 text-[11px] text-main-500">
                  +{extraToppings} más
                </span>
              )}
            </div>
          </div>
        )}

        {/* 4. Price + actions row — pinned to bottom */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">

          {/* Price */}
          <span className="text-xl font-bold text-[#1C1C1E]">${price}</span>

          {/* Info button + Agregar button */}
          <div className="flex items-center gap-1.5">

            {/* Info button */}
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-main-500/60 transition-colors duration-200 hover:bg-main-100/70 hover:text-main-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-400/50 cursor-pointer"
                aria-label="Más información"
                aria-expanded={isInfoOpen}
              >
                <InfoIcon />
              </button>

              {isInfoOpen && (
                <div
                  data-menu="popover"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full right-0 mb-2 z-[1000] w-72 rounded-xl border border-main-100 bg-white p-4 text-sm text-[#1C1C1E] shadow-xl"
                >
                  <p className="whitespace-pre-line leading-relaxed text-[#6B7280]">
                    {long_desc ?? ''}
                  </p>
                  <div className="mt-2.5 text-xs text-main-400">
                    Toca afuera para cerrar
                  </div>
                </div>
              )}
            </div>

            {/* Visual add indicator — the whole card is the tap target */}
            <span
              aria-hidden="true"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition-all duration-200 select-none ${
                isDisabled
                  ? 'bg-main-300/40 text-main-400'
                  : added
                  ? 'bg-main-400 text-white scale-110'
                  : 'bg-main-500 text-white'
              }`}
            >
              {added ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                </svg>
              )}
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
}
