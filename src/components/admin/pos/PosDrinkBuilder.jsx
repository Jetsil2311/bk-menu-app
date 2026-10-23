import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { DrinkCup } from '../../drinkBuilder/DrinkCup'
import { Drawer, inputCls } from '../ui'
import { formatMoney } from '../../../utils/cart'
import {
  NAME_MAX, buildCartItem, computeTotal, deriveCupVisual, firstIncompleteStep, nameFromItem, selectedOptionsOf,
  selectionsFromItem, toggleSelection,
} from '../../../utils/drinkBuilder'

const ruleLabel = (step) => {
  const kind = step.type === 'single' ? 'Elige 1' : step.maxSelections ? `Hasta ${step.maxSelections}` : 'Varios'
  return step.required ? kind : `${kind} · opcional`
}

// Cashier version of "Arma tu bebida": every step on one screen, big tap
// targets, running total. Same config, prices and stock recipe as the
// customer builder.
export const PosDrinkBuilder = ({ isOpen, config, initialItem, onClose, onConfirm }) => {
  const [selections, setSelections] = useState({})
  const [name, setName] = useState('')
  const [qty, setQty] = useState(1)
  const stepRefs = useRef({})

  useEffect(() => {
    if (!isOpen) return
    setSelections(initialItem ? selectionsFromItem(config, initialItem) : {})
    setName(initialItem ? nameFromItem(config, initialItem) : '')
    setQty(initialItem?.qty || 1)
    // Reset only when (re)opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialItem])

  if (!isOpen) return null

  const unit = computeTotal(config, selections)
  const missing = firstIncompleteStep(config, selections)
  const isEditing = Boolean(initialItem)

  const confirm = () => {
    if (missing !== -1) {
      stepRefs.current[config.steps[missing].id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    onConfirm({ item: buildCartItem(config, selections, name), qty })
  }

  return (
    <Drawer
      isOpen
      wide
      onClose={onClose}
      title={config.title}
      subtitle={isEditing ? 'Editando bebida del pedido' : 'Arma la bebida del cliente'}
      footer={(
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl bg-main-800 p-1">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Menos" className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-light-100 transition hover:bg-white/5 disabled:opacity-40">
              <Minus size={16} />
            </button>
            <span className="min-w-6 text-center font-bold tabular-nums text-light-100">{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Más" className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-light-100 transition hover:bg-white/5">
              <Plus size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={confirm}
            className={`inline-flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${missing === -1
              ? 'bg-primary text-snow hover:bg-secondary'
              : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
              }`}
          >
            {missing === -1
              ? <>{isEditing ? 'Guardar cambios' : 'Agregar al pedido'} · <span className="tabular-nums">{formatMoney(unit * qty)}</span></>
              : <>Falta: {config.steps[missing].name}</>}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        {/* Live cup + total */}
        <div className="customer-preview flex items-center gap-4 overflow-hidden rounded-2xl bg-primary px-4 py-3 text-snow">
          <div className="h-24 shrink-0">
            <DrinkCup visual={deriveCupVisual(config, selections)} label="Vista de la bebida" size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-snow/70">Precio</p>
            <p className="font-display text-3xl font-semibold tabular-nums">{formatMoney(unit)}</p>
            <p className="text-xs text-snow/70">Base {formatMoney(config.basePrice)} + extras</p>
          </div>
        </div>

        {config.steps.map((step) => {
          const chosen = selections[step.id] || []
          const lacking = step.required && chosen.length === 0
          return (
            <section
              key={step.id}
              ref={(el) => { stepRefs.current[step.id] = el }}
              aria-labelledby={`pos-step-${step.id}`}
              className={`rounded-2xl border bg-main-900 p-3.5 ${lacking ? 'border-amber-500/40' : 'border-white/10'}`}
            >
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <h3 id={`pos-step-${step.id}`} className="font-bold text-light-100">{step.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${lacking ? 'bg-amber-500/15 text-amber-400' : 'bg-main-800 text-light-200/75'}`}>
                  {ruleLabel(step)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={step.name}>
                {step.options.map((o) => {
                  const on = chosen.includes(o.id)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSelections((prev) => toggleSelection(prev, step, o.id))}
                      className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors active:scale-[0.97] ${on
                        ? 'border-primary bg-primary text-snow'
                        : 'border-white/15 bg-main-800 text-light-100 hover:border-primary/40'
                        }`}
                    >
                      {o.color && (
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: o.color }} aria-hidden="true" />
                      )}
                      {o.name}
                      {o.priceModifier > 0 && (
                        <span className={`text-xs tabular-nums ${on ? 'text-snow/85' : 'text-light-200/70'}`}>+{formatMoney(o.priceModifier)}</span>
                      )}
                      {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}

        <div>
          <label htmlFor="pos-drink-name" className="mb-1.5 block text-sm font-bold text-light-100">
            Nombre de la bebida <span className="font-normal text-light-200/65">(opcional)</span>
          </label>
          <input
            id="pos-drink-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            maxLength={NAME_MAX}
            placeholder="Ej. La de Ana"
            autoComplete="off"
            className={inputCls}
          />
        </div>

        {/* Plain-text recap the cashier can read back to the customer */}
        <p className="text-sm text-light-200/75">
          {config.steps.flatMap((s) => selectedOptionsOf(s, selections).map((o) => o.name)).join(' · ') || 'Toca los ingredientes que pide el cliente.'}
        </p>
      </div>
    </Drawer>
  )
}

PosDrinkBuilder.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  config: PropTypes.shape({
    title: PropTypes.string.isRequired,
    basePrice: PropTypes.number.isRequired,
    steps: PropTypes.array.isRequired,
  }).isRequired,
  initialItem: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
}
