import PropTypes from 'prop-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'

// Desktop coverflow slot config: [offset, widthPx, heightPx, opacity, zIndex]
const D_SLOTS = [
  [-2, 88, 141, 0.18, 0],
  [-1, 144, 230, 0.45, 1],
  [0, 200, 320, 1, 2],
  [+1, 144, 230, 0.45, 1],
  [+2, 88, 141, 0.18, 0],
]



export const PromoCarousel = ({ onAddToCart }) => {
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
    onAddToCart?.({
      id: slide.linkedId,
      name: p.name,
      price: p.price,
      fromRect,
      flyImageSrc: p.imageUrl || null,
    })
    fireToast(`${p.name} agregado`)
  }, [productMap, onAddToCart, fireToast])

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
      <div className="hidden md:block relative w-full bg-main-950 select-none overflow-hidden pt-[104px]">

        {/* Toast */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 rounded-full bg-main-800 text-light-200 text-xs px-4 py-2 pointer-events-none whitespace-nowrap transition-opacity duration-300"
          style={{ opacity: toast ? 1 : 0 }}
        >
          {toast || '\u00A0'}
        </div>

        {/* Track */}
        <div className="flex items-center justify-center py-10 pb-20" style={{ gap: 0 }}>
          {D_SLOTS.map(([offset, w, h, opacity, zIndex]) => {
            const slide = getSlide(dCurrent, offset)
            const isCenter = offset === 0
            const isFar = Math.abs(offset) === 2
            const product = productMap[slide?.linkedId]
            return (
              <div
                key={offset}
                onClick={() => {
                  if (isCenter) triggerAdd(slide, dCenterImg.current)
                  else setDCurrent(wrap(dCurrent + offset))
                }}
                style={{
                  width: w, height: h, opacity, zIndex,
                  flexShrink: 0,
                  margin: '0 10px',
                  cursor: 'pointer',
                  borderRadius: 14,
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
                  background: '#000',
                }}
              >
                {/* Letterboxed 9:16 image */}
                <img
                  ref={isCenter ? dCenterImg : undefined}
                  src={slide?.imageUrl}
                  alt={slide?.altText || ''}
                  draggable={false}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                />
                {/* Gradient + content */}
                {!isFar && (
                  <>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: '55%',
                      background: 'linear-gradient(to top, rgba(38,16,11,0.95) 0%, transparent 100%)',
                    }} />
                    {product && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: isCenter ? '12px' : '8px',
                        zIndex: 2,
                      }}>
                        <div style={{
                          color: '#fef8e1',
                          fontWeight: 500,
                          fontSize: isCenter ? 13 : 10,
                          lineHeight: 1.2,
                          marginBottom: isCenter ? 4 : 0,
                        }}>
                          {product.name}
                        </div>
                        {isCenter && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{
                              background: '#fef8e1', color: '#743121',
                              fontSize: 12, fontWeight: 500,
                              padding: '3px 8px', borderRadius: 20,
                            }}>
                              ${product.price}
                            </span>
                            <span style={{
                              background: '#743121', color: '#fef8e1',
                              borderRadius: '50%', width: 22, height: 22,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 16, lineHeight: 1,
                            }}>
                              +
                            </span>
                          </div>
                        )}
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
          <div className="flex justify-center items-center gap-[6px] pb-4">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir a promoción ${i + 1}`}
                onClick={() => setDCurrent(i)}
                style={{
                  border: 'none', padding: 0, cursor: 'pointer',
                  borderRadius: 9999,
                  background: i === dCurrent ? '#743121' : '#c9a68a',
                  width: i === dCurrent ? 18 : 7,
                  height: 7,
                  transition: 'all 0.25s',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile floating overlay (below md) — no container, center image only ── */}
      {showModal && (() => {
        const mSlide = getSlide(mCurrent, 0)
        const mProduct = productMap[mSlide?.linkedId]
        return (
          <div
            className="md:hidden fixed inset-0 z-200 flex flex-col items-center justify-center"
            style={{ background: 'rgba(20,8,4,0.72)' }}
          >
            {/* X close button — top-right */}
            <button
              type="button"
              onClick={dismissModal}
              aria-label="Cerrar"
              className="absolute top-5 right-5 flex items-center justify-center w-9 h-9 rounded-full bg-white/15 text-light-200 text-base backdrop-blur-sm"
            >
              ✕
            </button>

            {/* Center slide image + flanking arrows */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => setMCurrent(wrap(mCurrent - 1))}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15 text-light-200 backdrop-blur-sm shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8 10L4 6l4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div
                ref={mCenterImg}
                style={{
                  width: '72vw',
                  maxWidth: 260,
                  aspectRatio: '9/16',
                  borderRadius: 18,
                  overflow: 'hidden',
                  position: 'relative',
                  background: '#000',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                }}
              >
                <img
                  src={mSlide?.imageUrl}
                  alt={mSlide?.altText || ''}
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
                {/* Gradient + product info */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: '45%',
                  background: 'linear-gradient(to top, rgba(38,16,11,0.95) 0%, transparent 100%)',
                }} />
                {mProduct && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px', zIndex: 2 }}>
                    <div style={{ color: '#fef8e1', fontWeight: 500, fontSize: 14, marginBottom: 6 }}>{mProduct.name}</div>
                    <span style={{
                      background: '#fef8e1', color: '#743121',
                      fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20, display: 'inline-block',
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
                className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15 text-light-200 backdrop-blur-sm shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
                      background: i === mCurrent ? '#fef8e1' : 'rgba(254,248,225,0.35)',
                      width: i === mCurrent ? 16 : 6,
                      height: 6,
                      transition: 'all 0.25s',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 mt-5 w-[72vw]" style={{ maxWidth: 260 }}>
              <button
                type="button"
                onClick={() => {
                  const imgEl = mCenterImg.current?.querySelector('img') ?? null
                  triggerAdd(mSlide, imgEl)
                }}
                className="flex-1 rounded-xl bg-main-600 text-light-200 text-sm font-medium py-3"
              >
                + Agregar al carrito
              </button>
              <button
                type="button"
                onClick={dismissModal}
                className="rounded-xl px-4 py-3 text-xs text-light-200/80"
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
}
