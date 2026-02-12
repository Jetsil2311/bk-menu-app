import { useEffect, useLayoutEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
const BASE_URL = import.meta.env.BASE_URL;

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
  onAddToCart,
}) => {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isFlavorsOpen, setIsFlavorsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const imgRef = useRef(null);
  const dropdownBtnRef = useRef(null);
  const cardInstanceId = useRef(`card-${id}-${Math.random().toString(36).slice(2)}`);

  // Close menus when clicking anywhere except inside the menus
  useEffect(() => {
    const handlePointerDown = (e) => {
      // If nothing is open, do nothing
      if (!isInfoOpen && !isFlavorsOpen) return;

      // Keep open if the click is inside a menu panel or a menu button
      const menuEl = e.target.closest?.('[data-menu="popover"], [data-menu="dropdown"], [data-menu-btn]');
      if (menuEl) return;

      // Otherwise close (works for clicks inside the card and anywhere outside it)
      setIsInfoOpen(false);
      setIsFlavorsOpen(false);
    };

    const handleGlobalOpen = (e) => {
      // If another card opened a menu, close ours
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
      const menuHeight = 260; // approx height for direction decision
      const spaceBelow = window.innerHeight - rect.bottom;
      const shouldDropUp = spaceBelow < menuHeight;
      setDropUp(shouldDropUp);

      const top = shouldDropUp
        ? Math.max(8, rect.top - menuHeight)
        : rect.bottom;

      setDropPos({
        top: top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };

    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [isFlavorsOpen]);

  const hasFlavors = Array.isArray(flavors) && flavors.length > 0;
  const isDisabled = isActive === false;

  return (
    <li
      ref={wrapperRef}
      className={`relative overflow-visible ${isInfoOpen || isFlavorsOpen ? "z-[999]" : "z-0"} w-full flex items-center gap-3 rounded-xl bg-light-200 px-4  py-4 text-main-800 shadow-[inset_1px_1px_5px_rgba(69,26,3,0.10)] ${isDisabled ? "opacity-75" : ""}`}
    >
      <img
        className="h-28 mr-5 ml-2 w-28 shrink-0 rounded-xl object-cover shadow-xl"
        ref={imgRef}
        src={imageUrl || `${BASE_URL}products/${id}${image ?? ''}`}
        alt={name}
        loading="lazy"
      />

      <div className="min-w-0 flex-1">
        <h4 className="text-lg font-semibold leading-tight">{name}</h4>
        <p className="mt-1 text-sm text-main-600">{desc}</p>
        <div className="mt-2 text-base font-semibold text-main-700">${price}</div>

        <div className="mt-3 flex items-center gap-2">
          {/* Info button + popover */}
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-main-600  transition hover:bg-light-400/40 focus:outline-none hover:shadow-sm shadow-md"
              aria-label="More info"
              aria-expanded={isInfoOpen}
            >
              <span className="text-lg leading-none">+</span>
            </button>

            {isInfoOpen && (
              <div data-menu="popover" className="absolute left-0 top-10 z-[1000] w-72 rounded-xl border border-light-400/60 bg-light-200 p-3 text-sm text-main-800 shadow-xl">
                <p className="whitespace-pre-line">{long_desc ?? ''}</p>
                <div className="mt-2 text-xs text-main-500">Haz click afuera para cerrar</div>
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
                  // Announce this card is opening a menu so other cards close theirs
                  document.dispatchEvent(
                    new CustomEvent("bk-menu:open", { detail: { sourceId: cardInstanceId.current } })
                  );
                  if (!isDisabled) {
                    setIsFlavorsOpen((v) => !v);
                    setIsInfoOpen(false);
                  }
                }}
                disabled={isDisabled}
                className={`inline-flex h-8 items-center justify-center gap-2 rounded-md text-main-600 transition hover:bg-light-400/40 focus:outline-none shadow-lg hover:shadow-md px-3 ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
                aria-expanded={isFlavorsOpen}
              >
                {isDisabled ? "Agotado" : "Agregar a la cesta"}
                <span className={`text-xs transition ${isFlavorsOpen ? "rotate-180" : ""}`}>▾</span>
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
                    className={`overflow-hidden rounded-xl border border-light-400/60 bg-light-200 shadow-xl`}
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
                            id,
                            name,
                            price,
                            option: flavor,
                            fromRect: rect,
                            flyImageSrc: src,
                          });
                          setIsFlavorsOpen(false);
                        }}
                          className="w-full text-left px-3 py-2 text-sm text-main-800 hover:bg-light-400/40"
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
                onAddToCart?.({ id, name, price, fromRect: rect, flyImageSrc: src });
              }}
              disabled={isDisabled}
              className={`inline-flex h-8 items-center justify-center rounded-md text-main-600 transition hover:bg-light-400/40 focus:outline-none shadow-lg hover:shadow-md px-3 ${isDisabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {isDisabled ? "Agotado" : "Agregar a la cesta"}
            </button>
          )}
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
  id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onAddToCart: PropTypes.func,
};
