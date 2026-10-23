import PropTypes from 'prop-types'

export const ConfirmDialog = ({
  title = '¿Eliminar?',
  message,
  confirmLabel = 'Eliminar',
  pendingLabel = 'Eliminando...',
  onConfirm,
  onCancel,
  isPending = false,
  panelClassName = 'bg-main-900',
}) => (
  <div role="alertdialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[72] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
    <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${panelClassName}`}>
      <h3 className="font-display text-xl font-semibold text-light-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-light-200/80">{message}</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onCancel} autoFocus className="flex-1 min-h-[44px] cursor-pointer rounded-xl border border-white/15 bg-main-900 text-sm font-bold text-light-100 transition-colors hover:bg-white/5">
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} disabled={isPending} className="flex-1 min-h-[44px] cursor-pointer rounded-xl bg-red-600 text-sm font-bold text-snow transition-colors hover:bg-red-700 disabled:opacity-50">
          {isPending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </div>
  </div>
)

ConfirmDialog.propTypes = {
  title: PropTypes.string,
  message: PropTypes.node.isRequired,
  confirmLabel: PropTypes.string,
  pendingLabel: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isPending: PropTypes.bool,
  panelClassName: PropTypes.string,
}
