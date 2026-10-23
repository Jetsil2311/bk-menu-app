import PropTypes from 'prop-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import { storyImageUrl } from '../utils/cloudinary'

// Desktop coverflow geometry by distance from the center frame.
// Every frame is locked to 9:16 (Instagram story size — all carousel images
// are stories), so images fill the frame edge-to-edge with no letterboxing.
// Frames are full center size and shrink with `scale`; `x` is the frame
// center's distance from the track center in center-frame widths, plus
// `gaps` slot gaps. ±3 only shows on xl. ±4 is an invisible parking spot
// frames slide in from and out to, so nothing ever pops into place.
const D_LAYOUT = [
  { x: 0, gaps: 0, scale: 1, opacity: 1, z: 4 },
  { x: 0.86, gaps: 1, scale: 0.72, opacity: 0.7, z: 3 },
  { x: 1.47, gaps: 2, scale: 0.5, opacity: 0.4, z: 2 },
  { x: 1.89, gaps: 3, scale: 0.34, opacity: 0.25, z: 1 },
  { x: 2.16, gaps: 4, scale: 0.2, opacity: 0, z: 0 },
]
const D_REACH = D_LAYOUT.length - 1

// Center frame height: fits the viewport under the 104px navbar with room
// for the dots, never taller than 600px or shorter than 360px.
const STORY_H = 'clamp(360px, calc(100vh - 104px - 130px), 600px)'

const SLIDE_EASE = 'cubic-bezier(0.25,0.46,0.45,0.94)'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Signed shortest step from slide `from` to slide `to` on a ring of n slides.
const ringDelta = (from, to, n) => {
  const d = (((to - from) % n) + n) % n
  return d > n / 2 ? d - n : d
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Absolute strip positions to render around `pos`: the visible reach plus
// half the ring, so any jump (dots, side-frame clicks) already has its
// frames mounted in a parking spot and can slide them in.
const stripAround = (pos, reach, n) => {
  const extra = Math.ceil(n / 2)
  const out = []
  for (let p = pos - reach - extra; p <= pos + reach + extra; p++) out.push(p)
  return out
}

const useMediaQuery = (q) => {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(q).matches
  )
  useEffect(() => {
    const mql = window.matchMedia(q)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [q])
  return matches
}

export const PromoCarousel = ({ onAddToCart, toppingsMap = {} }) => {
  const [slides, setSlides] = useState([])
  const [productMap, setProductMap] = useState({})
  const [loading, setLoading] = useState(true)
  // Positions on an endless strip (not wrapped), so every move is a real
  // slide in one direction — including from the last promo to the first.
  const [dPos, setDPos] = useState(0)
  // Mobile also remembers where it came from, to tell which frames slide.
  const [mNav, setMNav] = useState({ pos: 0, from: 0 })
  const [toast, setToast] = useState('')
  const [showModal, setShowModal] = useState(false)
  const toastTimer = useRef(null)
  const dCenterImg = useRef(null)
  const mCenterImg = useRef(null)
  const touchX = useRef(null)
  const isXl = useMediaQuery('(min-width: 1280px)')

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
  const dCurrent = wrap(dPos)
  const mCurrent = wrap(mNav.pos)
  const moveMBy = (delta) => {
    if (delta) setMNav(cur => ({ pos: cur.pos + delta, from: cur.pos }))
  }
  const slideTransition = (cssProps) =>
    prefersReducedMotion ? 'none' : cssProps.map(prop => `${prop} 0.45s ${SLIDE_EASE}`).join(', ')

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

        {/* Track — frames are keyed by strip position and glide between slots */}
        <div
          className="relative [--slot-gap:16px] lg:[--slot-gap:20px]"
          style={{ '--story-h': STORY_H, height: `calc(${STORY_H} + 56px)` }}
        >
          {stripAround(dPos, D_REACH, n).map((p) => {
            const rel = p - dPos
            const offset = clamp(rel, -D_REACH, D_REACH)
            const slot = D_LAYOUT[Math.abs(offset)]
            const visible = slot.opacity > 0 && (Math.abs(offset) < 3 || isXl)
            const slide = slides[wrap(p)]
            const isCenter = rel === 0
            const product = productMap[slide?.linkedId]
            return (
              <div
                key={p}
                aria-hidden={visible ? undefined : true}
                aria-label={isCenter || !visible ? undefined : 'Ver esta promoción'}
                onClick={() => {
                  if (isCenter) triggerAdd(slide, dCenterImg.current)
                  else setDPos(p)
                }}
                style={{
                  position: 'absolute',
                  top: 32,
                  left: '50%',
                  height: 'var(--story-h)',
                  aspectRatio: '9 / 16',
                  marginLeft: 'calc(var(--story-h) * -9 / 32)',
                  transform: `translateX(calc(${Math.sign(offset)} * (var(--story-h) * 9 / 16 * ${slot.x} + var(--slot-gap) * ${slot.gaps}))) scale(${slot.scale})`,
                  opacity: visible ? slot.opacity : 0,
                  zIndex: slot.z,
                  pointerEvents: visible ? 'auto' : 'none',
                  cursor: 'pointer',
                  borderRadius: 28,
                  boxShadow: isCenter ? '0 30px 60px -25px var(--color-dark-900)' : '0 0 0 0 transparent',
                  overflow: 'hidden',
                  transition: slideTransition(['transform', 'opacity', 'box-shadow']),
                  willChange: 'transform',
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
                {/* Gradient + content — fades in on the center frame only */}
                <div style={{
                  opacity: isCenter ? 1 : 0,
                  transition: slideTransition(['opacity']),
                }}>
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
                </div>
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
                onClick={() => setDPos(dPos + ringDelta(dCurrent, i, n))}
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
        const mSlide = slides[mCurrent]
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
                onClick={() => moveMBy(-1)}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-white/15 text-light-200 backdrop-blur-sm shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8 10L4 6l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Frame — slides are keyed by strip position and slide sideways */}
              <div
                onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
                onTouchEnd={(e) => {
                  if (touchX.current == null) return
                  const dx = e.changedTouches[0].clientX - touchX.current
                  touchX.current = null
                  if (Math.abs(dx) > 40) moveMBy(dx < 0 ? 1 : -1)
                }}
                style={{
                  width: 'min(78vw, calc(100vw - 124px))',
                  maxWidth: 380,
                  aspectRatio: '9/16',
                  borderRadius: 28,
                  overflow: 'hidden',
                  position: 'relative',
                  background: 'var(--color-dark-900)',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                  touchAction: 'pan-y',
                }}
              >
                {stripAround(mNav.pos, 1, n).map((p) => {
                  const rel = p - mNav.pos
                  const fromRel = p - mNav.from
                  const offset = clamp(rel, -1, 1)
                  // A parked slide switching sides (e.g. on a dot jump) moves
                  // instantly while off-frame instead of sweeping across it.
                  const crossesOffFrame = Math.sign(rel) * Math.sign(fromRel) === -1
                  const slide = slides[wrap(p)]
                  const product = productMap[slide?.linkedId]
                  return (
                    <div
                      key={p}
                      aria-hidden={rel === 0 ? undefined : true}
                      style={{
                        position: 'absolute', inset: 0,
                        transform: `translateX(${offset * 100}%)`,
                        transition: crossesOffFrame ? 'none' : slideTransition(['transform']),
                        zIndex: rel === 0 ? 2 : 1,
                        willChange: 'transform',
                      }}
                    >
                      <img
                        ref={rel === 0 ? mCenterImg : undefined}
                        src={storyImageUrl(slide?.imageUrl)}
                        alt={slide?.altText || ''}
                        draggable={false}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {/* Gradient + product info */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        height: '32%',
                        background: 'linear-gradient(to top, rgba(38,16,11,0.95) 0%, transparent 100%)',
                      }} />
                      {product && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 18px', zIndex: 2 }}>
                          <div style={{ color: 'var(--color-light-200)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, marginBottom: 8 }}>{product.name}</div>
                          <span style={{
                            background: 'var(--color-light-200)', color: 'var(--color-primary)',
                            fontSize: 15, fontWeight: 600, padding: '5px 14px', borderRadius: 20, display: 'inline-block',
                          }}>
                            ${product.price}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => moveMBy(1)}
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
                    onClick={() => moveMBy(ringDelta(mCurrent, i, n))}
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
                  triggerAdd(mSlide, mCenterImg.current)
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
