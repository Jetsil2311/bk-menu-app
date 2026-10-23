/* eslint-disable react/prop-types */
import { useEffect } from 'react'
import { X } from 'lucide-react'

// Shared admin form primitives — one look for every editor drawer.

export const inputCls =
  'w-full min-h-[44px] rounded-xl border border-white/15 bg-main-900 px-3.5 text-[0.95rem] text-light-100 placeholder-light-200/50 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'

export const textareaCls = inputCls + ' py-2.5 resize-none'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-primary px-4 text-sm font-bold text-snow transition-colors hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-white/15 bg-main-900 px-4 text-sm font-bold text-light-100 transition-colors hover:bg-white/5 disabled:opacity-50 cursor-pointer'

export const iconBtn =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl text-light-200/70 transition-colors hover:bg-white/5 hover:text-light-100 cursor-pointer disabled:opacity-40'

export const iconBtnDanger =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl text-light-200/70 transition-colors hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer disabled:opacity-40'

// Label + optional hint under it + the control.
export const Field = ({ label, hint, required, htmlFor, children, className = '' }) => (
  <div className={className}>
    {label && (
      <label htmlFor={htmlFor} className="block text-sm font-bold text-light-100 mb-1.5">
        {label}
        {required && <span className="text-rose-400 ml-0.5" aria-label="obligatorio">*</span>}
      </label>
    )}
    {children}
    {hint && <p className="mt-1.5 text-xs text-light-200/70 leading-snug">{hint}</p>}
  </div>
)

// A titled block inside a drawer (Información, Foto, Personalización…).
export const FormSection = ({ icon: Icon, title, hint, children, action }) => (
  <section className="rounded-2xl border border-white/10 bg-main-900 p-4 sm:p-5">
    <div className="flex items-start gap-3 mb-4">
      {Icon && (
        <span className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary dark:text-main-300 flex items-center justify-center">
          <Icon size={18} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-[0.95rem] font-bold text-light-100">{title}</h3>
        {hint && <p className="text-xs text-light-200/70 mt-0.5 leading-snug">{hint}</p>}
      </div>
      {action}
    </div>
    <div className="space-y-4">{children}</div>
  </section>
)

// Accessible on/off switch with a visible label.
export const Toggle = ({ checked, onChange, label, hint, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="w-full flex items-center gap-3 text-left cursor-pointer disabled:opacity-50"
  >
    <span className="flex-1 min-w-0">
      {label && <span className="block text-sm font-bold text-light-100">{label}</span>}
      {hint && <span className="block text-xs text-light-200/70 mt-0.5 leading-snug">{hint}</span>}
    </span>
    <span
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-emerald-600' : 'bg-white/20'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-snow shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </span>
  </button>
)

// Compact switch for list rows (no label text, uses aria-label).
export const MiniSwitch = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
    className="inline-flex h-10 w-12 items-center justify-center cursor-pointer disabled:opacity-40"
  >
    <span className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${checked ? 'bg-emerald-600' : 'bg-white/20'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-snow shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </span>
  </button>
)

// Two-or-more option pill selector.
export const Segmented = ({ value, onChange, options, ariaLabel }) => (
  <div role="radiogroup" aria-label={ariaLabel} className="grid gap-1 rounded-xl bg-main-800 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map((opt) => {
      const active = value === opt.value
      return (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(opt.value)}
          className={`min-h-[40px] rounded-lg px-3 text-sm font-bold transition-all cursor-pointer ${
            active ? 'bg-main-900 text-primary dark:text-main-300 shadow-sm ring-1 ring-white/10' : 'text-light-200/70 hover:text-light-100'
          }`}
        >
          {opt.label}
        </button>
      )
    })}
  </div>
)

// Selectable chip (checkbox semantics) for tag-like lists.
export const ChipCheck = ({ checked, onChange, children }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors cursor-pointer ${
      checked
        ? 'border-primary bg-primary text-snow'
        : 'border-white/15 bg-main-900 text-light-200 hover:border-primary/40'
    }`}
  >
    {children}
  </button>
)

export const Notice = ({ tone = 'error', icon: Icon, children }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm font-semibold ${
      tone === 'error' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
    }`}
  >
    {Icon && <Icon size={16} className="mt-0.5 shrink-0" />}
    <span>{children}</span>
  </div>
)

// Right-side drawer (full screen on phones) with a sticky header and an
// optional sticky footer so Guardar is always reachable on long forms.
export const Drawer = ({ isOpen, onClose, title, subtitle, children, footer, wide = false }) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* z-[70]: above the mobile BottomTabBar (z-60) and its Más drawer (z-65) */}
      <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed inset-y-0 right-0 z-[71] flex w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} flex-col bg-main-950 shadow-2xl`}
        style={{ animation: 'drawerIn 220ms cubic-bezier(0.32,0.72,0,1)' }}
      >
        <style>{'@keyframes drawerIn{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion: reduce){[role=dialog]{animation:none!important}}'}</style>
        <div className="flex items-center gap-3 px-5 sm:px-6 h-[68px] shrink-0 border-b border-white/10 bg-main-900">
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl font-semibold text-light-100 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-light-200/70 truncate">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className={iconBtn}>
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">{children}</div>
        {footer && (
          <div
            className="shrink-0 border-t border-white/10 bg-main-900 px-4 sm:px-6 py-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  )
}

// Empty state with a short explanation and an optional action.
export const EmptyState = ({ icon: Icon, title, children, action }) => (
  <div className="rounded-2xl border border-dashed border-white/20 bg-main-900 px-6 py-10 text-center">
    {Icon && (
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-main-300">
        <Icon size={22} />
      </span>
    )}
    <p className="font-bold text-light-100">{title}</p>
    {children && <p className="mt-1 text-sm text-light-200/70 max-w-sm mx-auto">{children}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)
