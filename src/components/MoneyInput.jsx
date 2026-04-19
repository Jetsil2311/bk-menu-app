import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

/**
 * RTL money input — digits flow in from the right, always displayed as $0.00.
 * value:    number (dollars)
 * onChange: (number) => void
 * max:      optional number cap in dollars (e.g. for loyalty redemption)
 */
export const MoneyInput = ({ value = 0, onChange, max, className = '', inputClassName = '', ...rest }) => {
  const [cents, setCents] = useState(() => Math.round((value || 0) * 100))

  // Reset when parent explicitly zeros out (e.g. form clear)
  useEffect(() => {
    if (!value) setCents(0)
  }, [value])

  const capCents = max !== undefined ? Math.round(max * 100) : 9_999_999

  const commit = (raw) => {
    const c = Math.max(0, Math.min(Math.round(raw), capCents))
    setCents(c)
    onChange(c / 100)
  }

  // Desktop: intercept keystrokes before browser modifies the input
  const handleKeyDown = (e) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      commit(cents * 10 + parseInt(e.key, 10))
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      commit(Math.floor(cents / 10))
    }
  }

  // Mobile fallback: virtual keyboards don't reliably fire onKeyDown
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    commit(digits ? parseInt(digits, 10) : 0)
  }

  const handleFocus = (e) => {
    const len = e.target.value.length
    e.target.setSelectionRange(len, len)
  }

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-light-200/40 pointer-events-none select-none font-medium">
        $
      </span>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        value={(cents / 100).toFixed(2)}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onFocus={handleFocus}
        className={`w-full pl-8 ${inputClassName}`}
      />
    </div>
  )
}

MoneyInput.propTypes = {
  value:         PropTypes.number,
  onChange:      PropTypes.func.isRequired,
  max:           PropTypes.number,
  className:     PropTypes.string,
  inputClassName: PropTypes.string,
}
