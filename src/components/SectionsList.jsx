import { MenuSection } from './MenuSection'

// Renders menu sections with loading/error states and section filtering by route.
export const SectionsList = ({
  isLoading,
  error,
  sections,
  pathname,
  onAddToCart,
  toppingsMap = {},
}) => {
  // Skeletons shown while sections are loading from Firestore.
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-10">
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`section-skeleton-${index}`}
              className="rounded-[1.75rem] bg-surface p-6 shadow-[0_10px_30px_-18px_var(--color-ink)]"
            >
              <div className="h-5 w-40 rounded-full bg-primary/10 animate-pulse" />
              <div className="mt-3 h-4 w-72 max-w-full rounded-full bg-primary/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state when Firestore fails.
  if (error) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-10">
        <div className="rounded-3xl bg-fresa p-6 text-sm font-semibold text-fresa-ink">
          {error}
        </div>
      </div>
    )
  }

  if (!sections.length) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-10">
        <div className="rounded-3xl bg-surface p-6 text-sm text-ink-soft">
          No hay secciones disponibles todavía.
        </div>
      </div>
    )
  }

  return (
    <>
      {sections.map((section, idx) =>
        `/${section.category?.toLowerCase?.()}` === pathname || pathname === '/' ? (
          <div
            key={section.docId ?? section.id}
            id={`section-${section.name}`}
            data-section-anchor={section.name}
            data-reveal
            style={{ transitionDelay: `${Math.min(idx * 60, 240)}ms` }}
            className="opacity-0 translate-y-6 transition-all duration-700 ease-out will-change-transform"
          >
            <MenuSection desc={section.desc} onAddToCart={onAddToCart} toppingsMap={toppingsMap} index={idx}>
              {section.name}
            </MenuSection>
          </div>
        ) : null
      )}
    </>
  )
}
