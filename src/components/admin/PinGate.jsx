import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import PropTypes from 'prop-types'
import { ADMIN_PIN } from '../../config/adminPin'

// Phone-style keypad layout
const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['backspace', '0', 'cancel'],
]
const ALL_KEYS = ROWS.flat()

// ─── PinGate ──────────────────────────────────────────────────────────────────
// Wraps a protected route. Shows a full-screen PIN overlay before revealing
// the child content. Local `unlocked` state resets every time this component
// mounts (i.e. every navigation to a protected route), so no session caching.

export const PinGate = ({ children }) => {
  const [unlocked, setUnlocked]   = useState(false)
  const [digits, setDigits]       = useState([])
  const [shaking, setShaking]     = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')
  const overlayRef                = useRef(null)
  const navigate                  = useNavigate()

  const handleKey = useCallback((key) => {
    if (shaking) return

    if (key === 'cancel') {
      navigate('/admin/pedidos')
      return
    }

    if (key === 'backspace') {
      setDigits(prev => prev.slice(0, -1))
      setErrorMsg('')
      return
    }

    setDigits(prev => {
      if (prev.length >= 4) return prev
      const next = [...prev, key]

      if (next.length === 4) {
        if (next.join('') === ADMIN_PIN) {
          // Correct — unlock after state settles
          setTimeout(() => {
            setDigits([])
            setUnlocked(true)
          }, 0)
        } else {
          // Wrong — shake, then clear
          setShaking(true)
          setErrorMsg('PIN incorrecto, intenta de nuevo')
          setTimeout(() => {
            setShaking(false)
            setDigits([])
          }, 420)
        }
      } else {
        setErrorMsg('')
      }

      return next
    })
  }, [shaking, navigate])

  // Escape → cancel
  useEffect(() => {
    if (unlocked) return
    const handler = (e) => {
      if (e.key === 'Escape') navigate('/admin/pedidos')
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [unlocked, navigate])

  // Focus trap — keep focus cycling inside the overlay buttons only
  useEffect(() => {
    if (unlocked) return
    const el = overlayRef.current
    if (!el) return

    const buttons = () => Array.from(el.querySelectorAll('button[data-pin-key]'))

    // Auto-focus first key on mount
    const timer = setTimeout(() => buttons()[0]?.focus(), 50)

    const trap = (e) => {
      if (e.key !== 'Tab') return
      e.preventDefault()
      const arr = buttons()
      const idx = arr.indexOf(document.activeElement)
      const next = e.shiftKey
        ? (idx - 1 + arr.length) % arr.length
        : (idx + 1) % arr.length
      arr[next]?.focus()
    }
    document.addEventListener('keydown', trap)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', trap)
    }
  }, [unlocked])

  if (unlocked) return children

  const overlay = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Acceso restringido"
      className="fixed inset-0 bg-main-950 flex flex-col items-center justify-center p-6 select-none"
      style={{ zIndex: 9999, animation: 'pinFadeIn 150ms ease-out both' }}
    >
      <style>{`
        @keyframes pinFadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes pinShake {
          0%,100% { transform: translateX(0) }
          15%     { transform: translateX(-10px) }
          35%     { transform: translateX(10px) }
          55%     { transform: translateX(-7px) }
          75%     { transform: translateX(7px) }
          90%     { transform: translateX(-3px) }
        }
      `}</style>

      <div className="w-full max-w-[300px] flex flex-col items-center gap-7">

        {/* ── Brand ────────────────────────────────────────────────────── */}
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-light-100">
            Bubble Kaapeh
          </h1>
          <p className="text-sm text-light-200/50">
            Acceso restringido — ingresa tu PIN
          </p>
        </div>

        {/* ── Digit circles ─────────────────────────────────────────────── */}
        <div
          className="flex gap-3.5"
          style={shaking ? { animation: 'pinShake 420ms ease-in-out' } : undefined}
        >
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`
                w-14 h-14 rounded-2xl border-2 flex items-center justify-center
                transition-all duration-150
                ${digits[i] !== undefined
                  ? 'border-main-400 bg-main-500/15'
                  : 'border-white/10 bg-white/[0.03]'
                }
              `}
            >
              {digits[i] !== undefined && (
                <div className="w-3.5 h-3.5 rounded-full bg-main-400" />
              )}
            </div>
          ))}
        </div>

        {/* ── Error message (always reserves space to prevent layout jump) ── */}
        <p
          className={`
            text-xs font-medium text-rose-400 -mt-3 h-4
            transition-opacity duration-200
            ${errorMsg ? 'opacity-100' : 'opacity-0'}
          `}
          aria-live="polite"
        >
          {errorMsg}
        </p>

        {/* ── Keypad ───────────────────────────────────────────────────── */}
        <div className="w-full grid grid-cols-3 gap-2.5">
          {ALL_KEYS.map(key => {
            const isBackspace = key === 'backspace'
            const isCancel    = key === 'cancel'
            const isDigit     = !isBackspace && !isCancel

            return (
              <button
                key={key}
                type="button"
                data-pin-key={key}
                onClick={() => handleKey(key)}
                aria-label={isBackspace ? 'Borrar' : isCancel ? 'Cancelar' : key}
                className={`
                  h-14 rounded-2xl text-base font-semibold border
                  transition-all duration-150 cursor-pointer
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-main-400/60
                  active:scale-95
                  ${isCancel
                    ? 'border-rose-500/20 bg-rose-500/[0.08] text-rose-400 hover:bg-rose-500/15 text-xs'
                    : isBackspace
                    ? 'border-white/5 bg-white/[0.05] text-light-200/60 hover:bg-white/10 hover:text-light-100'
                    : 'border-white/5 bg-main-800/60 text-light-100 hover:bg-main-700/70'
                  }
                  ${isDigit && digits.length >= 4 ? 'opacity-40 pointer-events-none' : ''}
                `}
              >
                {isBackspace ? (
                  <span className="flex items-center justify-center">
                    <svg
                      width="20" height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                      <line x1="18" y1="9" x2="12" y2="15" />
                      <line x1="12" y1="9" x2="18" y2="15" />
                    </svg>
                  </span>
                ) : isCancel ? (
                  'Cancelar'
                ) : (
                  key
                )}
              </button>
            )
          })}
        </div>

      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

PinGate.propTypes = {
  children: PropTypes.node.isRequired,
}
