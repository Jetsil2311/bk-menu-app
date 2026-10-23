import PropTypes from 'prop-types'
import { getSectionIcon, getSectionTone } from '../utils/menuTheme'

// Playful section header: tinted blob icon, rounded display title,
// hand-drawn squiggle underline and a short description.
export const SectionBanner = ({ children, desc, index = 0, count = null }) => {
    const tone = getSectionTone(index)
    const Icon = getSectionIcon(children)

    return (
        <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 pt-10 pb-5 sm:pt-14 sm:pb-6">
            <div className="wobble-hover flex items-start gap-4 sm:gap-5">
                <span
                    className={`wobble-target blob inline-flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center ${tone.bg} ${tone.ink} shadow-[inset_0_-4px_0_rgba(0,0,0,0.06)] -rotate-6`}
                    aria-hidden="true"
                >
                    <Icon size={28} strokeWidth={2} />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2 className="font-display text-[1.75rem] sm:text-4xl font-semibold leading-none text-ink">
                            {children}
                        </h2>
                        {count > 0 && (
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tone.bg} ${tone.ink}`}>
                                {count} {count === 1 ? 'opción' : 'opciones'}
                            </span>
                        )}
                    </div>

                    {/* Hand-drawn squiggle underline */}
                    <svg
                        className="mt-2 h-2.5 w-28 text-secondary/60"
                        viewBox="0 0 120 10"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M2 6 Q 12 0 22 6 T 42 6 T 62 6 T 82 6 T 102 6 T 118 5"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                    </svg>

                    {desc && (
                        <p className="mt-2 max-w-2xl text-[0.95rem] sm:text-base leading-relaxed text-ink-soft">
                            {desc}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

SectionBanner.propTypes = {
    children: PropTypes.string.isRequired,
    desc: PropTypes.string,
    index: PropTypes.number,
    count: PropTypes.number,
}
