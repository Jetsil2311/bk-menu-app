/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Edit2, Minus, PenLine, Plus, X } from 'lucide-react'
import { formatMoney } from '../../../utils/cart'
import { getItemLineTotal } from '../../../utils/posCalculations'

export const TicketItem = ({ item, onChangeQty, onRemove, onSetNote, onEdit }) => {
  const [noteOpen, setNoteOpen] = useState(false)
  const optionSummary = item.selectedOptions?.map((option) => option.optionName).join(', ') ?? ''
  const toppingSummary = item.selectedToppings?.map((topping) => topping.name).join(', ') ?? ''
  const hasCustomisation = Boolean(optionSummary || toppingSummary)

  return (
    <div className="border-b border-white/5 last:border-0">
      <div className="flex items-start gap-2 px-4 py-3">
        <div className="mt-0.5 flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onChangeQty(item.cartItemId, -1)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white/5 text-light-200/60 transition-colors hover:bg-white/10 hover:text-light-100">
            <Minus size={12} />
          </button>
          <span className="w-5 select-none text-center text-sm font-bold text-light-100">{item.qty}</span>
          <button type="button" onClick={() => onChangeQty(item.cartItemId, 1)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white/5 text-light-200/60 transition-colors hover:bg-white/10 hover:text-light-100">
            <Plus size={12} />
          </button>
        </div>

        <button type="button" onClick={() => onEdit?.(item)} title={onEdit ? 'Editar opciones' : undefined} className={`group/item -mx-1 flex-1 min-w-0 rounded-lg px-1 py-0.5 text-left transition-colors ${onEdit ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold leading-snug text-light-100">{item.name}</p>
            {onEdit && hasCustomisation && <Edit2 size={10} className="shrink-0 text-light-200/20 transition-colors group-hover/item:text-light-200/50" />}
          </div>
          {(optionSummary || toppingSummary) && <p className="mt-0.5 truncate text-xs leading-relaxed text-light-200/40">{[optionSummary, toppingSummary].filter(Boolean).join(' · ')}</p>}
          {item.itemNote && !noteOpen && <p className="mt-0.5 truncate text-xs text-amber-400/70">✎ {item.itemNote}</p>}
        </button>

        <div className="mt-0.5 flex shrink-0 items-center gap-1">
          <span className="min-w-[56px] text-right text-sm font-semibold tabular-nums text-light-100">{formatMoney(getItemLineTotal(item))}</span>
          <button type="button" onClick={() => setNoteOpen((open) => !open)} title="Nota del item" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-light-200/25 transition-colors hover:text-amber-400"><PenLine size={13} /></button>
          <button type="button" onClick={() => onRemove(item.cartItemId)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-light-200/25 transition-colors hover:text-rose-400"><X size={13} /></button>
        </div>
      </div>

      {noteOpen && (
        <div className="px-4 pb-3">
          <input type="text" placeholder="Nota para este item..." value={item.itemNote || ''} onChange={(event) => onSetNote(item.cartItemId, event.target.value)} autoFocus className="w-full rounded-xl border border-white/10 bg-main-800/60 px-3 py-1.5 text-xs text-light-200 outline-none transition placeholder:text-light-200/25 focus:border-amber-700/40" />
        </div>
      )}
    </div>
  )
}
