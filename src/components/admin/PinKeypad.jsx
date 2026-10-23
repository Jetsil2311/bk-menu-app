import { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'

// Extracted from the old PinGate.jsx keypad — same visuals (digit grid,
// shake-on-error, keyboard input on pointer:fine devices, focus trap),
// generalized into a reusable component for StationGate.

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['backspace', '0', 'cancel'],
]
const ALL_KEYS = ROWS.flat()

export const PinKeypad = ({ length = 4, onComplete, onCancel, title, subtitle }) => {
  const [digits, setDigits] = useState([])
  const [shaking, setShaking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const containerRef = useRef(null)

  const shake = useCallback((message) => {
    setShaking(true)
    setErrorMsg(message)
    setTimeout(() => {
      setShaking(false)
      setDigits([])
    }, 420)
  }, [])

  const handleKey = useCallback((key) => {
    if (shaking) return

    if (key === 'cancel') {
      onCancel?.()
      return
    }

    if (key === 'backspace') {
      setDigits(prev => prev.slice(0, -1))
      setErrorMsg('')
      return
    }

    setDigits(prev => {
      if (prev.length >= length) return prev
      const next = [...prev, key]
      if (next.length === length) {
        setTimeout(() => onComplete?.(next.join(''), { shake, reset: () => setDigits([]) }), 0)
      } else {
        setErrorMsg('')
      }
      return next
    })
  }, [shaking, length, onComplete, onCancel, shake])

  // Escape → cancel
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  // Focus trap — keep focus cycling inside the keypad buttons only
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const buttons = () => Array.from(el.querySelectorAll('button[data-pin-key]'))
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
  }, [])

  // Physical keyboard input — desktop only (pointer: fine = mouse/trackpad, not touch)
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const handler = (e) => {
      if (/^[0-9]$/.test(e.key)) handleKey(e.key)
      else if (e.key === 'Backspace') handleKey('backspace')
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleKey])

  return (
    <div ref={containerRef} className="w-full max-w-[300px] flex flex-col items-center gap-7">
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

      {(title || subtitle) && (
        <div className="text-center space-y-1.5">
          {title && <h1 className="font-display text-3xl font-semibold text-light-100">{title}</h1>}
          {subtitle && <p className="text-sm text-light-200/70">{subtitle}</p>}
        </div>
      )}

      <div
        className="flex gap-3.5"
        style={shaking ? { animation: 'pinShake 420ms ease-in-out' } : undefined}
      >
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={`
              w-14 h-14 rounded-2xl border-2 flex items-center justify-center
              transition-all duration-150
              ${digits[i] !== undefined
                ? 'border-primary bg-primary/10'
                : 'border-white/15 bg-main-900'
              }
            `}
          >
            {digits[i] !== undefined && (
              <div className="w-3.5 h-3.5 rounded-full bg-primary" />
            )}
          </div>
        ))}
      </div>

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
                h-16 rounded-2xl text-xl font-bold border
                transition-all duration-150 cursor-pointer
                focus:outline-none focus-visible:ring-2 focus-visible:ring-main-400/60
                active:scale-95
                ${isCancel
                  ? 'border-transparent bg-transparent text-rose-400 hover:bg-rose-500/10 !text-sm'
                  : isBackspace
                  ? 'border-transparent bg-transparent text-light-200/70 hover:bg-white/5 hover:text-light-100'
                  : 'border-white/10 bg-main-900 text-light-100 shadow-[0_2px_0_var(--color-main-700)] hover:bg-main-800'
                }
                ${isDigit && digits.length >= length ? 'opacity-40 pointer-events-none' : ''}
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
  )
}

PinKeypad.propTypes = {
  length: PropTypes.number,
  onComplete: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  title: PropTypes.string,
  subtitle: PropTypes.string,
}
