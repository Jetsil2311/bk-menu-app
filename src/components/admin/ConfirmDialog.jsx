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
  <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
    <div className={`w-full max-w-sm rounded-3xl border border-white/10 p-6 shadow-2xl ${panelClassName}`}>
      <h3 className="text-base font-semibold text-light-100">{title}</h3>
      <p className="mt-1 text-sm text-light-200/60">{message}</p>
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 cursor-pointer rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-light-200/70 transition-colors hover:bg-white/10">
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} disabled={isPending} className="flex-1 cursor-pointer rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50">
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
