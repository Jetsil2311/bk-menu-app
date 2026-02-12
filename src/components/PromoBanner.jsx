// Lightweight promo layout that can be dismissed quickly.
export const PromoBanner = ({ title, message, onClose }) => {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] bg-main-700/95 text-light-200 shadow-[0_-20px_40px_rgba(0,0,0,0.35)]">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-6 px-6 py-6 sm:px-8 lg:px-10">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.35em] text-light-200/70">
            Promoción activa
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold">{title}</p>
          {message && (
            <p className="mt-2 text-base sm:text-lg text-light-200/85">{message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-light-200 transition hover:border-white/70 hover:text-light-100"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
