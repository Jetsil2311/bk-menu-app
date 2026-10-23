import PropTypes from 'prop-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import { storyImageUrl } from '../utils/cloudinary'

// Desktop coverflow slot config: [offset, scale, opacity, zIndex, className]
// Every frame is locked to 9:16 (Instagram story size — all carousel images
// are stories), so images fill the frame edge-to-edge with no letterboxing.
// `scale` multiplies the center frame height (--story-h); ±3 only on xl.
const D_SLOTS = [
  [-3, 0.34, 0.25, 0, 'hidden xl:block'],
  [-2, 0.5, 0.4, 1, ''],
  [-1, 0.72, 0.7, 2, ''],
  [0, 1, 1, 3, ''],
  [+1, 0.72, 0.7, 2, ''],
  [+2, 0.5, 0.4, 1, ''],
  [+3, 0.34, 0.25, 0, 'hidden xl:block'],
]

// Center frame height: fits the viewport under the 104px navbar with room
// for the dots, never taller than 600px or shorter than 360px.
const STORY_H = 'clamp(360px, calc(100vh - 104px - 130px), 600px)'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches



export const PromoCarousel = ({ onAddToCart, toppingsMap = {} }) => {
  const [slides, setSlides] = useState([])
  const [productMap, setProductMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [dCurrent, setDCurrent] = useState(0)
  const [mCurrent, setMCurrent] = useState(0)
  const [toast, setToast] = useState('')
  const [showModal, setShowModal] = useState(false)
  const toastTimer = useRef(null)
  const dCenterImg = useRef(null)
  const mCenterImg = useRef(null)

  useEffect(() => {
    setShowModal(true)
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([
      getDocs(query(collection(db, 'carousel'), orderBy('order', 'asc'))),
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'combos')).catch(() => ({ docs: [] })),
    ])
      .then(([slidesSnap, productsSnap, combosSnap]) => {
        if (!alive) return
        const allSlides = slidesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        // Support both old field name (isActive) and new field name (active)
        setSlides(allSlides.filter(s => s.active === true || s.isActive === true))
        const map = {}
          ;[...productsSnap.docs, ...combosSnap.docs].forEach(d => {
            const data = d.data()
            map[d.id] = {
              name: data.name ?? '',
              price: data.price ?? 0,
              imageUrl: data.imageUrl ?? '',
              image: data.image ?? '',
              desc: data.desc ?? '',
              long_desc: data.long_desc ?? '',
              optionGroups: Array.isArray(data.optionGroups) ? data.optionGroups : [],
              toppingIds: Array.isArray(data.toppingIds) ? data.toppingIds : [],
            }
          })
        setProductMap(map)
      })
      .catch(() => { })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const fireToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }, [])

  const triggerAdd = useCallback((slide, imgEl) => {
    const p = productMap[slide?.linkedId]
    if (!p) { fireToast('Producto no disponible'); return }
    const fromRect = imgEl?.getBoundingClientRect() ?? null
    const hasOptions = Array.isArray(p.optionGroups) && p.optionGroups.length > 0
    const availableToppings = p.toppingIds
      .map((tid) => toppingsMap[tid])
      .filter(Boolean)
    onAddToCart?.({
      id: slide.linkedId,
      name: p.name,
      price: p.price,
      desc: p.desc,
      long_desc: p.long_desc,
      image: p.image,
      imageUrl: p.imageUrl,
      fromRect,
      flyImageSrc: p.imageUrl || null,
      optionGroups: p.optionGroups,
      availableToppings,
    })
    // Toast only for direct adds — overlays show their own confirmation
    if (!hasOptions && availableToppings.length === 0) fireToast(`${p.name} agregado`)
  }, [productMap, toppingsMap, onAddToCart, fireToast])

  const dismissModal = useCallback(() => {
    setShowModal(false)
  }, [])

  if (loading || slides.length === 0) return null

  const n = slides.length
  const wrap = (idx) => ((idx % n) + n) % n
  const getSlide = (base, offset) => slides[wrap(base + offset)]

  return (
    <>
      {/* ── Desktop carousel (md and up) ─────────────────────────────── */}
      <div className="hidden md:block relative w-full bg-primary select-none overflow-hidden pt-[104px]">

        {/* Toast */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 rounded-full bg-ink text-surface text-xs px-4 py-2 pointer-events-none whitespace-nowrap transition-opacity duration-300"
          style={{ opacity: toast ? 1 : 0 }}
        >
          {toast || '\u00A0'}
        </div>

        {/* Track */}
        <div
          className="flex items-center justify-center gap-4 lg:gap-5 pt-8 pb-6"
          style={{ '--story-h': STORY_H, height: `calc(${STORY_H} + 56px)` }}
        >
          {D_SLOTS.map(([offset, scale, opacity, zIndex, slotClass]) => {
            const slide = getSlide(dCurrent, offset)
            const isCenter = offset === 0
            const product = productMap[slide?.linkedId]
            return (
              <div
                key={offset}
                className={slotClass}
                aria-label={isCenter ? undefined : 'Ver esta promoción'}
                onClick={() => {
                  if (isCenter) triggerAdd(slide, dCenterImg.current)
                  else setDCurrent(wrap(dCurrent + offset))
                }}
                style={{
                  height: `calc(var(--story-h) * ${scale})`,
                  aspectRatio: '9 / 16',
                  opacity, zIndex,
                  flexShrink: 0,
                  cursor: 'pointer',
                  borderRadius: isCenter ? 28 : 22,
                  boxShadow: isCenter ? '0 30px 60px -25px var(--color-dark-900)' : 'none',
                  overflow: 'hidden',
                  position: 'relative',
                  transition: prefersReducedMotion ? 'none' : 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
                  background: 'var(--color-dark-900)',
                }}
              >
                {/* 9:16 story image filling the 9:16 frame */}
                <img
                  ref={isCenter ? dCenterImg : undefined}
                  src={storyImageUrl(slide?.imageUrl)}
                  alt={slide?.altText || ''}
                  draggable={false}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                />
                {/* Gradient + content — center only; side frames show the story as-is */}
                {isCenter && (
                  <>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: '28%',
                      background: 'linear-gradient(to top, rgba(38,16,11,0.95) 0%, transparent 100%)',
                    }} />
                    {product && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '16px 16px 16px 20px',
                        zIndex: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            color: 'var(--color-light-200)',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 600,
                            fontSize: 19,
                            lineHeight: 1.15,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {product.name}
                          </div>
                          <div style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: 15, marginTop: 2 }}>
                            ${product.price}
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          style={{
                            background: 'var(--color-light-200)', color: 'var(--color-primary)',
                            borderRadius: '50%', width: 46, height: 46,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 26, fontWeight: 600, lineHeight: 1,
                            flexShrink: 0,
                          }}
                        >
                          +
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Dots */}
        {n > 1 && (
          <div className="flex justify-center items-center gap-[6px] pb-12">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir a promoción ${i + 1}`}
                onClick={() => setDCurrent(i)}
                style={{
                  border: 'none', padding: 0, cursor: 'pointer',
                  borderRadius: 9999,
                  background: i === dCurrent ? 'var(--color-surface)' : 'color-mix(in srgb, var(--color-surface) 35%, transparent)',
                  width: i === dCurrent ? 18 : 7,
                  height: 7,
                  transition: 'all 0.25s',
                }}
              />
            ))}
          </div>
        )}
        {/* Wavy edge into the cream menu */}
        <svg
          className="absolute bottom-0 left-0 block h-10 w-full text-bg"
          viewBox="0 0 400 32"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 18 C 50 4, 100 4, 150 16 S 250 30, 300 16 S 370 4, 400 14 L400 32 L0 32 Z" fill="currentColor" />
        </svg>
      </div>

      {/* ── Mobile floating overlay (below md) — no container, center image only ── */}
      {showModal && (() => {
        const mSlide = getSlide(mCurrent, 0)
        const mProduct = productMap[mSlide?.linkedId]
        return (
          <div
            className="md:hidden fixed inset-0 z-200 flex flex-col items-center justify-center"
            style={{
              background: 'rgba(20,8,4,0.72)',
              animation: prefersReducedMotion ? 'none' : 'modal-in 0.25s ease-out',
            }}
          >
            {/* X close button — top-right */}
            <button
              type="button"
              onClick={dismissModal}
              aria-label="Cerrar"
              className="absolute top-5 right-5 flex items-center justify-center w-11 h-11 rounded-full bg-white/15 text-light-200 text-base backdrop-blur-sm"
            >
              ✕
            </button>

            {/* Center slide image + flanking arrows */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => setMCurrent(wrap(mCurrent - 1))}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-white/15 text-light-200 backdrop-blur-sm shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8 10L4 6l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div
                ref={mCenterImg}
                style={{
                  width: 'min(78vw, calc(100vw - 124px))',
                  maxWidth: 380,
                  aspectRatio: '9/16',
                  borderRadius: 28,
                  overflow: 'hidden',
                  position: 'relative',
                  background: 'var(--color-dark-900)',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                }}
              >
                <img
                  src={storyImageUrl(mSlide?.imageUrl)}
                  alt={mSlide?.altText || ''}
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* Gradient + product info */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: '32%',
                  background: 'linear-gradient(to top, rgba(38,16,11,0.95) 0%, transparent 100%)',
                }} />
                {mProduct && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 18px', zIndex: 2 }}>
                    <div style={{ color: 'var(--color-light-200)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, marginBottom: 8 }}>{mProduct.name}</div>
                    <span style={{
                      background: 'var(--color-light-200)', color: 'var(--color-primary)',
                      fontSize: 15, fontWeight: 600, padding: '5px 14px', borderRadius: 20, display: 'inline-block',
                    }}>
                      ${mProduct.price}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => setMCurrent(wrap(mCurrent + 1))}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-white/15 text-light-200 backdrop-blur-sm shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Dots */}
            {n > 1 && (
              <div className="flex items-center gap-[6px] mt-4">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMCurrent(i)}
                    style={{
                      border: 'none', padding: 0, cursor: 'pointer',
                      borderRadius: 9999,
                      background: i === mCurrent ? 'var(--color-light-200)' : 'color-mix(in srgb, var(--color-light-200) 35%, transparent)',
                      width: i === mCurrent ? 16 : 6,
                      height: 6,
                      transition: 'all 0.25s',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 mt-5 w-[calc(100vw-32px)]" style={{ maxWidth: 380 }}>
              <button
                type="button"
                onClick={() => {
                  const imgEl = mCenterImg.current?.querySelector('img') ?? null
                  triggerAdd(mSlide, imgEl)
                  dismissModal()
                }}
                className="flex-1 rounded-full bg-primary text-surface font-display text-base font-medium py-3 min-h-[48px] cursor-pointer transition hover:bg-main-700"
              >
                + Agregar al carrito
              </button>
              <button
                type="button"
                onClick={dismissModal}
                className="rounded-full px-5 py-3 text-sm font-bold text-light-200/80 min-h-[48px] cursor-pointer transition hover:bg-white/10"
                style={{ border: '0.5px solid rgba(254,248,225,0.25)' }}
              >
                Ver menú
              </button>
            </div>

            {/* Toast */}
            <div
              className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full bg-main-950 text-light-200 text-xs px-4 py-2 pointer-events-none whitespace-nowrap transition-opacity duration-300"
              style={{ opacity: toast ? 1 : 0 }}
            >
              {toast || '\u00A0'}
            </div>
          </div>
        )
      })()}
    </>
  )
}

PromoCarousel.propTypes = {
  onAddToCart: PropTypes.func,
  toppingsMap: PropTypes.object,
}
