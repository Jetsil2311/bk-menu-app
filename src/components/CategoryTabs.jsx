import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { Sparkles } from 'lucide-react'
import { getSectionIcon } from '../utils/menuTheme'

// Sticky horizontal pill bar for category navigation.
// Sticks below the desktop navbar (top-[104px] on sm+) and at top-0 on mobile.
// Each chip has an icon + label; the active chip is kept scrolled into view.
// `onBuildDrink` adds a highlighted "Arma tu bebida" chip first.
export const CategoryTabs = ({ sections, activeSection, onTabClick, onBuildDrink, buildDrinkLabel = 'Arma tu bebida' }) => {
  const scrollerRef = useRef(null)
  const chipRefs = useRef({})

  // Keep the active chip visible as the user scrolls through the menu.
  // Scrolls the bar horizontally only, never the page.
  useEffect(() => {
    const scroller = scrollerRef.current
    const chip = chipRefs.current[activeSection]
    if (!scroller || !chip) return
    const target = chip.offsetLeft - scroller.clientWidth / 2 + chip.clientWidth / 2
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [activeSection])

  if (!sections || sections.length === 0) return null

  return (
    <div className="sticky top-0 sm:top-[104px] z-80 py-2.5 bg-bg/85 backdrop-blur-md shadow-[0_8px_24px_-18px_var(--color-ink)]">
      <div
        ref={scrollerRef}
        className="flex items-center gap-2 px-4 overflow-x-auto scrollbar-hide [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
        role="tablist"
        aria-label="Categorías del menú"
      >
        {onBuildDrink && (
          <button
            type="button"
            onClick={onBuildDrink}
            className="shrink-0 inline-flex min-h-[44px] items-center gap-2 cursor-pointer rounded-full bg-accent pl-2 pr-4 text-sm font-bold text-ink shadow-[0_6px_16px_-8px_var(--color-ink)] transition-all duration-200 hover:brightness-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface/70" aria-hidden="true">
              <Sparkles size={16} strokeWidth={2.25} />
            </span>
            {buildDrinkLabel}
          </button>
        )}
        {sections.map((section) => {
          const isActive = activeSection === section.name
          const Icon = getSectionIcon(section.name)
          return (
            <button
              key={section.docId ?? section.id}
              ref={(el) => { chipRefs.current[section.name] = el }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabClick(section.name)}
              className={`group shrink-0 inline-flex min-h-[44px] items-center gap-2 cursor-pointer rounded-full pl-2 pr-4 text-sm font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-95 ${isActive
                ? 'bg-primary text-surface shadow-[0_6px_16px_-6px_var(--color-primary)]'
                : 'bg-surface text-ink-soft ring-1 ring-primary/10 hover:ring-primary/30 hover:text-primary'
                }`}
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-surface/15' : 'bg-bg group-hover:bg-accent/60'
                  }`}
                aria-hidden="true"
              >
                <Icon size={16} strokeWidth={2.25} />
              </span>
              {section.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

CategoryTabs.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      docId: PropTypes.string,
      name: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeSection: PropTypes.string,
  onTabClick: PropTypes.func.isRequired,
  onBuildDrink: PropTypes.func,
  buildDrinkLabel: PropTypes.string,
}
