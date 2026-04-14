import PropTypes from 'prop-types'

// Sticky horizontal tab bar for category navigation.
// Sticks below the desktop navbar (top-[104px] on sm+) and at top-0 on mobile.
// Tabs are horizontally scrollable on small screens.
export const CategoryTabs = ({ sections, activeSection, onTabClick }) => {
  if (!sections || sections.length === 0) return null

  return (
    <div className="sticky top-0 sm:top-[104px] z-80 bg-main-950/95 backdrop-blur-sm border-b border-white/10">
      <div
        className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-hide"
        role="tablist"
        aria-label="Categorías del menú"
      >
        {sections.map((section) => {
          const isActive = activeSection === section.name
          return (
            <button
              key={section.docId ?? section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabClick(section.name)}
              className={`shrink-0 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-light-400/60 ${isActive
                ? 'bg-main-600 text-light-200'
                : 'text-light-300/70 hover:text-light-200 hover:bg-white/10'
                }`}
            >
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
}
