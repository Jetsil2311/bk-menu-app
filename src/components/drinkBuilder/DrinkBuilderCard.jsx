import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { DrinkCup } from './DrinkCup'
import { deriveCupVisual, randomSelections } from '../../utils/drinkBuilder'

const BUBBLES = [[6, 14, 0], [30, 10, 2.6], [55, 18, 1.3], [92, 12, 3.8]]
const DEMO_EVERY_MS = 2800

// Menu entry for "Arma tu bebida": a big playful card whose cup keeps
// mixing random drinks from the café's real ingredients.
export const DrinkBuilderCard = ({ config, onOpen }) => {
  const [demo, setDemo] = useState(() => randomSelections(config))

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setDemo(randomSelections(config))
    }, DEMO_EVERY_MS)
    return () => clearInterval(id)
  }, [config])

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 pt-6 sm:px-6 lg:px-8" aria-labelledby="drink-builder-card-title">
      <div className="relative overflow-hidden rounded-[2rem] bg-primary text-surface shadow-[0_24px_50px_-28px_var(--color-ink)]">
        {BUBBLES.map(([left, size, delay], i) => (
          <span
            key={i}
            className="bubble"
            style={{ left: `${left}%`, width: size, height: size, animationDelay: `${delay}s` }}
            aria-hidden="true"
          />
        ))}
        {/* Soft color blob behind the cup */}
        <span className="blob absolute -right-10 -top-8 h-64 w-64 bg-secondary/60 sm:right-4 sm:h-72 sm:w-72" aria-hidden="true" />

        <div className="relative flex items-center gap-2 py-6 pl-5 pr-2 sm:gap-6 sm:py-8 sm:pl-10 sm:pr-10">
          <div className="min-w-0 flex-1">
            <span className="inline-flex rotate-[-3deg] items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-ink">
              <Sparkles size={13} aria-hidden="true" />
              Nuevo
            </span>
            <h2 id="drink-builder-card-title" className="mt-3 font-display text-[1.9rem] font-semibold leading-[1.05] sm:text-4xl">
              {config.title}
            </h2>
            <p className="mt-2 max-w-md text-sm text-surface/80 sm:text-base">{config.tagline}</p>
            <button
              type="button"
              onClick={onOpen}
              className="mt-5 inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full bg-surface px-5 font-display text-base font-semibold text-primary shadow-[0_10px_22px_-12px_var(--color-ink)] transition hover:bg-accent active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              Crear la mía
              <Sparkles size={18} aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={onOpen}
            tabIndex={-1}
            aria-hidden="true"
            className="relative h-40 shrink-0 cursor-pointer transition-transform hover:-rotate-3 sm:h-56 lg:mr-8 lg:h-64"
          >
            <DrinkCup visual={deriveCupVisual(config, demo)} label="" size="sm" />
          </button>
        </div>
      </div>
    </section>
  )
}

DrinkBuilderCard.propTypes = {
  config: PropTypes.shape({
    title: PropTypes.string.isRequired,
    tagline: PropTypes.string,
    steps: PropTypes.array.isRequired,
  }).isRequired,
  onOpen: PropTypes.func.isRequired,
}
