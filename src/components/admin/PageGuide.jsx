import PropTypes from 'prop-types'
import { X } from 'lucide-react'

// "¿Cómo funciona esta sección?" — closed by default so pages open straight
// to their content; the "?" next to the page title (Topbar) opens it.
// Steps live in config/adminNav.jsx → PAGE_GUIDES.
export const PageGuide = ({ title, steps, onClose }) => {
  if (!steps?.length) return null

  return (
    <section
      id="page-guide"
      aria-label={`Cómo funciona ${title}`}
      className="alert-slide mb-5 rounded-2xl border border-white/10 bg-main-900 px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="pt-1.5 text-[0.95rem] font-bold text-light-100">Cómo funciona {title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ayuda"
          className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-light-200/60 hover:bg-white/5 hover:text-light-100 cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>
      <ol className="mt-2 max-w-3xl list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-light-200/80 marker:font-bold marker:text-primary dark:marker:text-main-300">
        {steps.map((step, i) => <li key={i} className="pl-1">{step}</li>)}
      </ol>
    </section>
  )
}

PageGuide.propTypes = {
  title: PropTypes.string.isRequired,
  steps: PropTypes.arrayOf(PropTypes.string),
  onClose: PropTypes.func.isRequired,
}
