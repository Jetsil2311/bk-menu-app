import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { ChevronDown, Lightbulb } from 'lucide-react'

const STORAGE_KEY = 'bk_page_guides_hidden'

const readHidden = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

// "¿Cómo funciona esta sección?" — open the first time someone visits a page,
// then folds into a small button once they tap "Entendido" (remembered on
// this device). Steps live in config/adminNav.jsx → PAGE_GUIDES.
export const PageGuide = ({ routeKey, title, steps }) => {
  const [open, setOpen] = useState(() => !readHidden().includes(routeKey))
  useEffect(() => { setOpen(!readHidden().includes(routeKey)) }, [routeKey])

  const setHidden = (hidden) => {
    try {
      const list = readHidden().filter((k) => k !== routeKey)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden ? [...list, routeKey] : list))
    } catch { /* private mode */ }
    setOpen(!hidden)
  }

  if (!steps?.length) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="mb-4 inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full bg-main-900 border border-white/10 text-xs font-semibold text-light-200/75 hover:text-light-100 cursor-pointer"
      >
        <Lightbulb size={14} /> ¿Cómo funciona {title}?
        <ChevronDown size={14} />
      </button>
    )
  }

  return (
    <section aria-label={`Cómo funciona ${title}`} className="mb-5 rounded-3xl border border-primary/15 bg-primary/[0.06] px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 shrink-0 rounded-2xl bg-primary/10 text-primary dark:text-main-300 flex items-center justify-center">
          <Lightbulb size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[0.95rem] font-bold text-light-100">¿Cómo funciona {title}?</h2>
          <ol className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-light-200/85 leading-snug">
                <span className="mt-px h-5 w-5 shrink-0 rounded-full bg-primary text-snow text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="shrink-0 min-h-[36px] px-3 rounded-xl text-xs font-bold text-primary dark:text-main-300 hover:bg-primary/10 cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </section>
  )
}

PageGuide.propTypes = {
  routeKey: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  steps: PropTypes.arrayOf(PropTypes.string),
}
