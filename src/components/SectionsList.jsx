import { MenuSection } from './MenuSection'

// Renders menu sections with loading/error states and section filtering by route.
export const SectionsList = ({
  isLoading,
  error,
  sections,
  pathname,
  onAddToCart,
}) => {
  // Skeletons shown while sections are loading from Firestore.
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-10">
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`section-skeleton-${index}`}
              className="rounded-3xl border border-white/10 bg-main-800/60 p-6 shadow-[0_28px_60px_rgba(0,0,0,0.45)]"
            >
              <div className="h-5 w-40 rounded-full bg-white/10 animate-pulse" />
              <div className="mt-3 h-4 w-72 rounded-full bg-white/10 animate-pulse" />
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
        <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-6 text-sm text-red-100">
          {error}
        </div>
      </div>
    )
  }

  if (!sections.length) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-10">
        <div className="rounded-3xl border border-white/10 bg-main-800/60 p-6 text-sm text-light-200/70">
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
            data-reveal
            style={{ transitionDelay: `${Math.min(idx * 60, 240)}ms` }}
            className="opacity-0 translate-y-6 transition-all duration-700 ease-out will-change-transform"
          >
            <MenuSection desc={section.desc} onAddToCart={onAddToCart}>
              {section.name}
            </MenuSection>
          </div>
        ) : null
      )}
    </>
  )
}
