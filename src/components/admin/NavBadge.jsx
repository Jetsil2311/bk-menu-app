import PropTypes from 'prop-types'
import { AlertTriangle } from 'lucide-react'

// Badge next to a nav label (see AdminAlertsContext → navBadges):
// a number = things waiting (e.g. web orders on Cobrar),
// 'warn' = something needs attention (e.g. stock running out).
// `dot` is the compact form for icon-only navs.
export const NavBadge = ({ value, dot = false, className = '' }) => {
  if (!value) return null
  const label = value === 'warn' ? 'Hay insumos por agotarse' : `${value} pedido${value !== 1 ? 's' : ''} esperando`

  if (dot) {
    return (
      <span
        aria-label={label}
        className={`absolute flex items-center justify-center rounded-full border-2 border-main-900 ${
          value === 'warn' ? 'h-4 w-4 bg-amber-500 text-snow' : 'h-[18px] min-w-[18px] px-1 bg-rose-600 text-[10px] font-bold text-snow'
        } ${className}`}
      >
        {value === 'warn' ? <AlertTriangle size={9} strokeWidth={3} /> : value}
      </span>
    )
  }

  return value === 'warn' ? (
    <span title={label} className={`inline-flex text-amber-400 ${className}`}>
      <AlertTriangle size={16} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  ) : (
    <span aria-label={label} className={`inline-flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-snow ${className}`}>
      {value}
    </span>
  )
}

NavBadge.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf(['warn'])]),
  dot: PropTypes.bool,
  className: PropTypes.string,
}
