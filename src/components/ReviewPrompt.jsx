import { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Star, X, Heart } from 'lucide-react'
import { REVIEW_URL } from '../config/business'
import {
  readReviewState, writeReviewState, shouldInvite, withShown, markReviewed, hasPendingOrder, clearPendingOrder,
} from '../utils/reviewPrompt'

const SHOWN_THIS_VISIT = 'bk_review_shown_visit'
const RETURN_DELAY_MS = 1200 // let them land back on the menu first
const FALLBACK_DELAY_MS = 10000 // WhatsApp opened without leaving this tab

// Small, non-blocking card (no backdrop, doesn't take focus) that invites
// the customer to review the café on Google after they come back from
// sending an order. Timing rules live in utils/reviewPrompt.js.
// `url` = the live review link (Admin → Landing); defaults to config/business.js.
export const ReviewPrompt = ({ url = REVIEW_URL }) => {
  const [stage, setStage] = useState('hidden') // hidden | ask | thanks
  const timer = useRef(null)
  const waiting = useRef(false)

  const tryShow = useCallback(() => {
    waiting.current = false
    clearTimeout(timer.current)
    clearPendingOrder()
    try { if (sessionStorage.getItem(SHOWN_THIS_VISIT)) return } catch { /* private mode */ }
    const state = readReviewState()
    if (!shouldInvite(state)) return
    writeReviewState(withShown(state))
    try { sessionStorage.setItem(SHOWN_THIS_VISIT, '1') } catch { /* private mode */ }
    setStage('ask')
  }, [])

  useEffect(() => {
    // The page may have been reloaded while the customer was in WhatsApp.
    if (hasPendingOrder()) {
      waiting.current = true
      timer.current = setTimeout(tryShow, RETURN_DELAY_MS)
    }

    const onOrderSent = () => {
      waiting.current = true
      clearTimeout(timer.current)
      timer.current = setTimeout(tryShow, FALLBACK_DELAY_MS)
    }
    const onVisibility = () => {
      if (!waiting.current) return
      clearTimeout(timer.current)
      if (document.visibilityState === 'visible') timer.current = setTimeout(tryShow, RETURN_DELAY_MS)
    }

    window.addEventListener('bk:order-sent', onOrderSent)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('bk:order-sent', onOrderSent)
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimeout(timer.current)
    }
  }, [tryShow])

  const close = useCallback(() => setStage('hidden'), [])

  useEffect(() => {
    if (stage === 'hidden') return undefined
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    const auto = stage === 'thanks' ? setTimeout(close, 2600) : null
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(auto) }
  }, [stage, close])

  const goReview = () => {
    markReviewed()
    window.open(url, '_blank', 'noopener,noreferrer')
    setStage('thanks')
  }

  if (stage === 'hidden') return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="review-title"
      className="review-in fixed inset-x-3 bottom-24 z-[90] font-body sm:inset-x-auto sm:right-5 sm:w-[23.5rem]"
    >
      <div className="relative overflow-hidden rounded-[1.75rem] bg-surface p-5 text-ink shadow-[0_24px_50px_-18px_var(--color-ink)] ring-1 ring-primary/10">
        {stage === 'ask' ? (
          <>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-latte hover:text-ink cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  size={20}
                  className="review-star fill-current text-mango-ink"
                  style={{ animationDelay: `${180 + i * 70}ms` }}
                />
              ))}
            </div>

            <h2 id="review-title" className="mt-3 pr-8 font-display text-2xl font-semibold leading-tight text-primary">
              ¿Te gusta Bubble Kaapeh?
            </h2>
            <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-soft">
              Cuéntalo en Google Maps. Tu reseña ayuda a que más gente nos encuentre.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={goReview}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[0.95rem] font-extrabold text-surface transition duration-200 hover:bg-secondary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 cursor-pointer"
              >
                <Star size={17} className="fill-current" aria-hidden="true" />
                Dejar reseña
              </button>
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full px-4 text-[0.95rem] font-bold text-ink-soft transition-colors hover:bg-latte hover:text-ink cursor-pointer"
              >
                Ahora no
              </button>
            </div>
          </>
        ) : (
          <p role="status" className="flex items-center gap-3 font-display text-xl font-semibold text-primary">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fresa text-fresa-ink">
              <Heart size={20} className="fill-current" aria-hidden="true" />
            </span>
            ¡Gracias por tu apoyo!
          </p>
        )}
      </div>
    </div>
  )
}

ReviewPrompt.propTypes = {
  url: PropTypes.string,
}
