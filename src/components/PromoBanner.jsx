import { Sparkles, X } from 'lucide-react'

// Floating promo "sticker" card that can be dismissed quickly.
export const PromoBanner = ({ title, message, onClose }) => {
  return (
    <div className="fixed inset-x-3 bottom-3 z-91 sm:inset-x-auto sm:left-5 sm:bottom-5 sm:max-w-md pb-safe sm:pb-0">
      <div className="relative flex items-start gap-3 rounded-[1.75rem] bg-mango p-4 pr-14 text-mango-ink shadow-[0_18px_40px_-14px_var(--color-ink)] ring-1 ring-mango-ink/10">
        <span className="blob inline-flex h-12 w-12 shrink-0 -rotate-6 items-center justify-center bg-surface text-primary">
          <Sparkles size={22} strokeWidth={2.25} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] opacity-80">
            Promoción activa
          </p>
          <p className="mt-0.5 font-display text-xl font-semibold leading-tight text-ink">{title}</p>
          {message && (
            <p className="mt-1 text-sm leading-snug">{message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar promoción"
          className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-surface/50 cursor-pointer"
        >
          <X size={20} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
