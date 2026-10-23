import PropTypes from 'prop-types'
import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from 'react'

// Animated "Arma tu bebida" cup. Draws whatever deriveCupVisual() returns:
//   liquids → the drink rises and tints (2+ liquids make an ombré:
//             first choice on top, latest at the bottom)
//   pearls  → drop in and bounce at the bottom
//   foam    → a cloud that puffs onto the surface
//   ice     → cubes bobbing near the top
// Option colors come from the café's config; options without a color use
// the menu's pastel tones.

const FALLBACK_TONES = [
  'var(--color-latte)', 'var(--color-taro)', 'var(--color-matcha)',
  'var(--color-fresa)', 'var(--color-mango)',
]

// Cup interior: rim at y=56, base at y=262 (viewBox 0 0 200 280).
const CUP_PATH = 'M34 56 L52 247 Q53.5 262 68 262 L132 262 Q146.5 262 148 247 L166 56 Z'
const CUP_TOP = 56
const CUP_DEPTH = 206

// Pearl spots: three rows hugging the tapered bottom.
const PEARL_SPOTS = [
  ...[61, 74, 87, 100, 113, 126, 139].map((x) => [x, 251]),
  ...[67, 80, 93, 107, 120, 133].map((x) => [x, 238]),
  ...[74, 87, 100, 113, 126].map((x) => [x, 225]),
]

const ICE_SPOTS = [[72, 18, -12], [104, 10, 8], [128, 22, -4], [88, 34, 16]]

const mix = (a, b) => `color-mix(in srgb, ${a} 50%, ${b})`

export const DrinkCup = forwardRef(function DrinkCup(
  { visual, label, size = 'lg', className = '' },
  ref
) {
  const svgRef = useRef(null)
  const uid = useId().replace(/:/g, '')
  useImperativeHandle(ref, () => svgRef.current)

  const liquids = visual.liquids.map((l, i) => l.color || FALLBACK_TONES[i % FALLBACK_TONES.length])
  const hasLiquid = liquids.length > 0
  const top = liquids[0]
  const bottom = liquids[liquids.length - 1]
  const middle = liquids.length >= 3 ? liquids[1] : liquids.length === 2 ? mix(top, bottom) : top

  // Fill level: empty until a liquid is chosen; a bit lower under foam.
  const fill = hasLiquid ? (visual.foam ? 0.74 : 0.8) : 0
  const liquidShift = CUP_DEPTH * (1 - fill) + (hasLiquid ? 0 : 14)

  const pearls = visual.pearls.length
    ? PEARL_SPOTS.map(([x, y], i) => {
      const p = visual.pearls[i % visual.pearls.length]
      return { x, y, color: p.color || 'var(--color-ink)', key: `${p.id}-${i}` }
    })
    : []
  const pearlKey = visual.pearls.map((p) => p.id).join('|')

  const iceCount = visual.ice ? Math.round(visual.ice.amount * ICE_SPOTS.length) : 0

  // A little "squish" whenever the drink changes.
  const signature = [
    liquids.join(','), pearlKey, visual.foam?.id ?? '', visual.ice?.id ?? '',
  ].join('#')
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const el = svgRef.current
    if (!el?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.animate(
      [
        { transform: 'scale(1, 1)' },
        { transform: 'scale(1.04, 0.97)' },
        { transform: 'scale(0.98, 1.02)' },
        { transform: 'scale(1, 1)' },
      ],
      { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
    )
  }, [signature])

  const stopStyle = (color) => ({ stopColor: color, transition: 'stop-color 600ms ease' })

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 280"
      role="img"
      aria-label={label}
      className={`drink-cup drink-cup--${size} block h-full w-auto overflow-visible ${className}`}
      style={{ transformOrigin: '50% 100%' }}
    >
      <defs>
        <clipPath id={`cup-${uid}`}>
          <path d={CUP_PATH} />
        </clipPath>
        <linearGradient id={`liquid-${uid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={stopStyle(bottom ?? 'transparent')} />
          <stop offset="0.5" style={stopStyle(middle ?? 'transparent')} />
          <stop offset="1" style={stopStyle(top ?? 'transparent')} />
        </linearGradient>
      </defs>

      {/* Straw — drawn first so the drink covers its lower half */}
      <g transform="rotate(14 112 70)">
        <rect x="103" y="-6" width="18" height="200" rx="9" fill="var(--color-accent)" />
        <rect x="103" y="-6" width="6" height="200" rx="3" fill="var(--color-surface)" opacity="0.45" />
      </g>

      {/* Cup back (frosted plastic) */}
      <path d={CUP_PATH} fill="var(--color-surface)" opacity="0.14" />

      <g clipPath={`url(#cup-${uid})`}>
        {/* Liquid + everything that floats on it moves together */}
        <g
          className="drink-cup__liquid"
          style={{ transform: `translateY(${liquidShift}px)` }}
        >
          <rect x="20" y={CUP_TOP + 6} width="160" height={CUP_DEPTH + 20} fill={`url(#liquid-${uid})`} />
          <g className="drink-cup__wave">
            <path
              d={`M-200 ${CUP_TOP + 8} q25 -9 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V${CUP_TOP + 20} H-200 Z`}
              fill={top ?? 'transparent'}
              style={{ transition: 'fill 600ms ease' }}
            />
          </g>
          {/* Shine on the liquid */}
          <rect x="48" y={CUP_TOP + 24} width="9" height="150" rx="4.5" fill="var(--color-surface)" opacity={hasLiquid ? 0.22 : 0} />

          {Array.from({ length: iceCount }, (_, i) => {
            const [x, y, r] = ICE_SPOTS[i]
            return (
              <g key={`${visual.ice.id}-${i}`} transform={`translate(${x} ${CUP_TOP + y}) rotate(${r})`}>
                <g className="drink-cup__ice" style={{ animationDelay: `${i * 90}ms, ${i * 400}ms` }}>
                  <rect x="-12" y="-12" width="24" height="24" rx="6" fill="var(--color-surface)" opacity="0.5" />
                  <rect x="-12" y="-12" width="24" height="24" rx="6" fill="none" stroke="var(--color-surface)" strokeWidth="1.5" opacity="0.85" />
                  <rect x="-7" y="-8" width="6" height="3" rx="1.5" fill="var(--color-surface)" opacity="0.9" />
                </g>
              </g>
            )
          })}

          {visual.foam && (
            <g key={visual.foam.id} transform={`translate(100 ${CUP_TOP + 4})`}>
              <path
                className="drink-cup__foam"
                d="M-74 12 C-80 -2 -64 -14 -52 -8 C-48 -24 -26 -26 -18 -14 C-10 -30 14 -30 20 -14 C30 -26 52 -22 52 -6 C66 -12 82 0 74 12 Z"
                fill={visual.foam.color || 'var(--color-surface)'}
              />
            </g>
          )}
        </g>

        {/* Pearls — keyed by their options so a change drops a new batch */}
        <g key={pearlKey}>
          {pearls.map((p, i) => (
            <g key={p.key} transform={`translate(${p.x} ${p.y})`}>
              <g className="drink-cup__pearl" style={{ animationDelay: `${i * 28}ms` }}>
                <circle r="7.5" fill={p.color} />
                <circle cx="-2.5" cy="-2.5" r="2.2" fill="var(--color-surface)" opacity="0.55" />
              </g>
            </g>
          ))}
        </g>
      </g>

      {/* Cup front: outline, shine and rim */}
      <path d={CUP_PATH} fill="none" stroke="var(--color-surface)" strokeWidth="3.5" strokeLinejoin="round" opacity="0.9" />
      <path d="M46 72 L58 228" stroke="var(--color-surface)" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
      <rect x="26" y="47" width="148" height="14" rx="7" fill="var(--color-surface)" />
      {!hasLiquid && (
        <path
          d="M52 90 L60 236 M148 90 L140 236"
          stroke="var(--color-surface)"
          strokeWidth="2"
          strokeDasharray="4 8"
          strokeLinecap="round"
          opacity="0.45"
        />
      )}
    </svg>
  )
})

DrinkCup.propTypes = {
  visual: PropTypes.shape({
    liquids: PropTypes.array.isRequired,
    pearls: PropTypes.array.isRequired,
    foam: PropTypes.object,
    ice: PropTypes.object,
  }).isRequired,
  label: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['sm', 'lg']),
  className: PropTypes.string,
}
