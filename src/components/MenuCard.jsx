import { useEffect, useLayoutEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
const BASE_URL = import.meta.env.BASE_URL;

// ─── SVG icons (no emojis as icons per design system) ────────────────────────
const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
  </svg>
);

const ChevronDownIcon = ({ rotated = false }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
    className={`w-4 h-4 transition-transform duration-200 ${rotated ? "rotate-180" : ""}`}>
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);
ChevronDownIcon.propTypes = { rotated: PropTypes.bool };

export const MenuCard = ({
  name,
  long_desc,
  desc,
  price,
  flavors,
  image,
  imageUrl,
  id,
  isActive = true,
  availableToppings = [],
  featured = false,
  popular = false,
  onAddToCart,
}) => {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isFlavorsOpen, setIsFlavorsOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const imgRef = useRef(null);
  const dropdownBtnRef = useRef(null);
  const cardInstanceId = useRef(`card-${id}-${Math.random().toString(36).slice(2)}`);

  // Close menus when clicking anywhere except inside them.
  useEffect(() => {
    const handlePointerDown = (e) => {
      if (!isInfoOpen && !isFlavorsOpen) return;
      const menuEl = e.target.closest?.('[data-menu="popover"], [data-menu="dropdown"], [data-menu-btn]');
      if (menuEl) return;
      setIsInfoOpen(false);
      setIsFlavorsOpen(false);
    };

    const handleGlobalOpen = (e) => {
      if (e?.detail?.sourceId && e.detail.sourceId !== cardInstanceId.current) {
        setIsInfoOpen(false);
        setIsFlavorsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("bk-menu:open", handleGlobalOpen);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("bk-menu:open", handleGlobalOpen);
    };
  }, [isInfoOpen, isFlavorsOpen]);

  useLayoutEffect(() => {
    if (!isFlavorsOpen || !dropdownBtnRef.current) return;

    const measure = () => {
      const rect = dropdownBtnRef.current.getBoundingClientRect();
      const menuHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuHeight
        ? Math.max(8, rect.top - menuHeight) + window.scrollY
        : rect.bottom + window.scrollY;
      setDropPos({ top, left: rect.left + window.scrollX, width: rect.width });
    };

    measure();
    // Reposition on resize only — scroll is handled by the close-on-scroll effect below.
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [isFlavorsOpen]);

  // Close the flavors dropdown (and info popover) on scroll or Escape key.
  useEffect(() => {
    if (!isFlavorsOpen && !isInfoOpen) return;

    const closeAll = () => {
      setIsFlavorsOpen(false);
      setIsInfoOpen(false);
    };

    const handleEsc = (e) => {
      if (e.key === "Escape") closeAll();
    };

    // capture: true so we catch scroll on any ancestor (including the category-tabs
    // sticky container); passive: true for scroll performance.
    window.addEventListener("scroll", closeAll, { passive: true, capture: true });
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("scroll", closeAll, { capture: true });
      window.removeEventListener("keydown", handleEsc);
    };
  }, [isFlavorsOpen, isInfoOpen]);

  const hasFlavors = Array.isArray(flavors) && flavors.length > 0;
  const isDisabled = isActive === false;
  const showBadge = featured || popular;
  const extraToppings = availableToppings.length > 1 ? availableToppings.length - 1 : 0;

  return (
    <li
      ref={wrapperRef}
      className={`relative overflow-visible flex flex-col rounded-2xl border border-amber-50 bg-light-100 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer ${isInfoOpen || isFlavorsOpen ? "z-999" : "z-0"
        } ${isDisabled ? "opacity-60" : ""}`}
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
            e.currentTarget.onerror = null;
            e.currentTarget.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='112' height='112' viewBox='0 0 112 112'><rect width='112' height='112' fill='%23e6c5be'/><text x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-size='32' fill='%23743121'>☕</text></svg>`;
          }}
        />

        {/* Warm gradient at bottom — softens the image-to-card-body edge */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(26,10,0,0.15), transparent)" }}
        />

        {/* Popular / featured badge */}
        {showBadge && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-main-600/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold text-light-200 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-amber-300">
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
      </div>

      {/* ── Card body ──────────────────────────────────────────────────── */}
      <div className="flex flex-col px-4 pb-4 pt-3 flex-1">

        {/* 1. Product name */}
        <h4 className="text-base font-semibold text-[#1a0a00] truncate leading-snug">
          {name}
        </h4>

        {/* 2. Short description */}
        {desc && (
          <p className="mt-1 text-sm italic text-[#6b5c52] line-clamp-2 leading-relaxed">
            {desc}
          </p>
        )}

        {/* Thin warm divider before toppings — only if there are toppings to show */}
        {availableToppings.length > 0 && (
          <div className="border-t border-amber-100 mt-2.5 pt-2">
            {/* 3. Toppings badge(s) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-main-300/30 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-main-600">
                ✦ Agrega {availableToppings[0].name} +${availableToppings[0].price}
              </span>
              {extraToppings > 0 && (
                <span className="inline-flex items-center rounded-full border border-main-200/40 bg-amber-50 px-2 py-0.5 text-[11px] text-main-500">
                  +{extraToppings} más
                </span>
              )}
            </div>
          </div>
        )}

        {/* 4. Price + add to cart row — pinned to bottom */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">

          {/* Price */}
          <span className="text-xl font-bold text-[#1a0a00]">${price}</span>

          {/* Actions: info button + add/flavors button */}
          <div className="flex items-center gap-1.5">

            {/* Info button */}
            <div className="relative">
              <button
                type="button"
                data-menu-btn
                onClick={() => {
                  document.dispatchEvent(
                    new CustomEvent("bk-menu:open", { detail: { sourceId: cardInstanceId.current } })
                  );
                  setIsInfoOpen((v) => !v);
                  setIsFlavorsOpen(false);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-main-500/60 transition-colors duration-200 hover:bg-amber-100/70 hover:text-main-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-400/50 cursor-pointer"
                aria-label="Más información"
                aria-expanded={isInfoOpen}
              >
                <InfoIcon />
              </button>

              {isInfoOpen && (
                <div
                  data-menu="popover"
                  className="absolute bottom-full right-0 mb-2 z-[1000] w-72 rounded-xl border border-amber-100 bg-[#faf6f0] p-4 text-sm text-[#1a0a00] shadow-xl"
                >
                  <p className="whitespace-pre-line leading-relaxed text-[#6b5c52]">{long_desc ?? ''}</p>
                  <div className="mt-2.5 text-xs text-main-400">Toca afuera para cerrar</div>
                </div>
              )}
            </div>

            {/* Flavors dropdown */}
            {hasFlavors && (
              <div className="relative">
                <button
                  type="button"
                  data-menu-btn
                  ref={dropdownBtnRef}
                  onClick={() => {
                    document.dispatchEvent(
                      new CustomEvent("bk-menu:open", { detail: { sourceId: cardInstanceId.current } })
                    );
                    if (!isDisabled) {
                      setIsFlavorsOpen((v) => !v);
                      setIsInfoOpen(false);
                    }
                  }}
                  disabled={isDisabled}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full bg-main-500 px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-main-400 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-main-400/60 cursor-pointer ${isDisabled ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  aria-expanded={isFlavorsOpen}
                >
                  {isDisabled ? "Agotado" : "Agregar"}
                  <ChevronDownIcon rotated={isFlavorsOpen} />
                </button>

                {isFlavorsOpen &&
                  ReactDOM.createPortal(
                    <ul
                      data-menu="dropdown"
                      style={{
                        position: "absolute",
                        top: dropPos.top,
                        left: dropPos.left,
                        minWidth: 224,
                        zIndex: 2147483647,
                      }}
                      className="overflow-hidden rounded-xl border border-amber-100 bg-[#faf6f0] shadow-xl"
                    >
                      {flavors.map((flavor, index) => (
                        <li key={index}>
                          <button
                            type="button"
                            onClick={(e) => {
                              const rect =
                                imgRef.current?.getBoundingClientRect?.() ??
                                e.currentTarget.getBoundingClientRect();
                              const src =
                                imgRef.current?.currentSrc || imgRef.current?.src || null;
                              onAddToCart?.({
                                id, name, price,
                                option: flavor,
                                fromRect: rect,
                                flyImageSrc: src,
                                availableToppings,
                              });
                              setIsFlavorsOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-[#1a0a00] hover:bg-amber-50 transition-colors duration-150 cursor-pointer"
                          >
                            {flavor}
                          </button>
                        </li>
                      ))}
                    </ul>,
                    document.body
                  )}
              </div>
            )}

            {/* Direct add button (no flavors) */}
            {!hasFlavors && (
              <button
                type="button"
                onClick={(e) => {
                  if (isDisabled) return;
                  const rect =
                    imgRef.current?.getBoundingClientRect?.() ??
                    e.currentTarget.getBoundingClientRect();
                  const src =
                    imgRef.current?.currentSrc || imgRef.current?.src || null;
                  onAddToCart?.({ id, name, price, fromRect: rect, flyImageSrc: src, availableToppings });
                }}
                disabled={isDisabled}
                className={`inline-flex h-9 items-center rounded-full bg-main-500 px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-main-400 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-main-400/60 cursor-pointer ${isDisabled ? "cursor-not-allowed opacity-60" : ""
                  }`}
              >
                {isDisabled ? "Agotado" : "Agregar"}
              </button>
            )}

          </div>
        </div>
      </div>
    </li>
  );
};

MenuCard.propTypes = {
  name: PropTypes.string.isRequired,
  long_desc: PropTypes.string,
  desc: PropTypes.string,
  price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  flavors: PropTypes.arrayOf(PropTypes.string),
  image: PropTypes.string,
  imageUrl: PropTypes.string,
  isActive: PropTypes.bool,
  featured: PropTypes.bool,
  popular: PropTypes.bool,
  id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  availableToppings: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string, name: PropTypes.string, price: PropTypes.number })
  ),
  onAddToCart: PropTypes.func,
};
