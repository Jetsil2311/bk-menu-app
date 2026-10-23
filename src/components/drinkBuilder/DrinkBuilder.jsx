import PropTypes from 'prop-types'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import {
  ArrowLeft, ArrowRight, Check, Cloud, Dices, Minus, Pencil, Plus, Snowflake, Sparkles, WandSparkles, X,
} from 'lucide-react'
import { DrinkCup } from './DrinkCup'
import {
  NAME_MAX,
  buildCartItem,
  computeTotal,
  deriveCupVisual,
  firstIncompleteStep,
  isStepComplete,
  randomSelections,
  resolveBuilder,
  selectedOptionsOf,
  suggestName,
  toggleSelection,
} from '../../utils/drinkBuilder'
import { formatMoney } from '../../utils/cart'

// Same pastel fallbacks as the cup, so a swatch matches what the cup shows.
const SWATCH_TONES = [
  'var(--color-latte)', 'var(--color-taro)', 'var(--color-matcha)',
  'var(--color-fresa)', 'var(--color-mango)',
]

const BUBBLES = [[10, 12, 0], [24, 18, 2.2], [78, 14, 1.1], [88, 22, 3.4], [62, 10, 4.2]]

const ruleLabel = (step) => {
  if (step.type === 'single') return step.required ? 'Elige 1' : 'Opcional · elige 1'
  if (step.maxSelections) return `${step.required ? '' : 'Opcional · '}Hasta ${step.maxSelections}`
  return step.required ? 'Elige los que quieras' : 'Opcional · los que quieras'
}

const money = (n) => formatMoney(n).replace(/\.00$/, '')

const Swatch = ({ visual, color, index }) => {
  const fill = color || (visual === 'pearls' ? 'var(--color-ink)' : SWATCH_TONES[index % SWATCH_TONES.length])
  if (visual === 'pearls') {
    return (
      <span className="relative inline-block h-11 w-11 shrink-0" aria-hidden="true">
        {[[4, 18], [18, 22], [12, 6], [24, 8]].map(([l, t], i) => (
          <span
            key={i}
            className="absolute h-4 w-4 rounded-full shadow-[inset_-2px_-2px_0_color-mix(in_srgb,var(--color-ink)_25%,transparent)]"
            style={{ left: l, top: t, background: fill }}
          />
        ))}
      </span>
    )
  }
  if (visual === 'foam' || visual === 'ice' || visual === 'none') {
    const Icon = visual === 'foam' ? Cloud : visual === 'ice' ? Snowflake : Sparkles
    return (
      <span
        className="blob inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink"
        style={{ background: visual === 'none' ? 'var(--color-mango)' : color || 'var(--color-bg)' }}
        aria-hidden="true"
      >
        <Icon size={20} strokeWidth={2.25} fill={visual === 'foam' ? 'var(--color-surface)' : 'none'} />
      </span>
    )
  }
  return (
    <span
      className="blob relative inline-block h-11 w-11 shrink-0 shadow-[inset_0_-6px_0_color-mix(in_srgb,var(--color-ink)_12%,transparent)]"
      style={{ background: fill }}
      aria-hidden="true"
    >
      <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-surface/70" />
    </span>
  )
}

Swatch.propTypes = {
  visual: PropTypes.string.isRequired,
  color: PropTypes.string,
  index: PropTypes.number.isRequired,
}

export const DrinkBuilder = ({ isOpen, onClose, config, onAdd }) => {
  const [mounted, setMounted] = useState(isOpen)
  const [entered, setEntered] = useState(false)
  const [selections, setSelections] = useState({})
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState('next')
  const [name, setName] = useState('')
  const [qty, setQty] = useState(1)
  const [lastPicked, setLastPicked] = useState(null)
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  const cupRef = useRef(null)
  const scrollRef = useRef(null)
  const chipsRef = useRef(null)
  const titleId = useId()

  // Mount → slide in; close → slide out, then unmount. The draft drink
  // survives closing, so nobody loses their creation by tapping outside.
  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
      return () => cancelAnimationFrame(raf)
    }
    setEntered(false)
    const t = setTimeout(() => setMounted(false), 320)
    return () => clearTimeout(t)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  // Escape closes; Tab stays inside the builder.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll(
        'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Only the steps/ingredients the current choices allow (admin "Solo si…"
  // rules). They depend on earlier steps only, so `index` stays put when a
  // choice hides or reveals something further along.
  const live = resolveBuilder(config, selections).config
  const steps = live.steps
  const summaryIndex = steps.length
  const index = Math.min(stepIndex, summaryIndex)
  const onSummary = index === summaryIndex
  const step = onSummary ? null : steps[index]
  const total = computeTotal(live, selections)
  const visual = deriveCupVisual(live, selections)
  const chosenNames = steps.flatMap((s) => selectedOptionsOf(s, selections).map((o) => o.name))
  const isEmpty = chosenNames.length === 0

  const goTo = useCallback((next, s = selections) => {
    setDirection(next >= index ? 'next' : 'back')
    setStepIndex(next)
    scrollRef.current?.scrollTo({ top: 0 })
    if (next === summaryIndex && !name.trim()) setName(suggestName(config, s))
  }, [index, summaryIndex, name, config, selections])

  const pick = (option) => {
    // Re-resolve so picks that this change rules out are dropped.
    setSelections((prev) => resolveBuilder(config, toggleSelection(prev, step, option.id)).selections)
    setLastPicked(option.id)
    navigator.vibrate?.(8)
  }

  const surprise = () => {
    const s = randomSelections(config)
    setSelections(s)
    setName(suggestName(config, s))
    setDirection('next')
    setStepIndex(summaryIndex)
    scrollRef.current?.scrollTo({ top: 0 })
    navigator.vibrate?.([8, 40, 8])
  }

  const missing = firstIncompleteStep(live, selections)

  // Keep the current step's chip visible (scrolls the chip row only).
  useEffect(() => {
    const row = chipsRef.current
    const chip = row?.querySelector('[aria-current="step"]')
    if (!row || !chip) return
    row.scrollTo({ left: Math.max(0, chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2), behavior: 'smooth' })
  }, [index, mounted])

  const addToCart = () => {
    if (missing !== -1) { goTo(missing); return }
    onAdd({
      item: buildCartItem(live, selections, name),
      qty,
      fromRect: cupRef.current?.getBoundingClientRect() ?? null,
    })
    setSelections({})
    setStepIndex(0)
    setName('')
    setQty(1)
  }

  if (!mounted) return null

  const stepDone = step ? isStepComplete(step, selections) : true
  const nextStep = steps[index + 1]

  return ReactDOM.createPortal(
    // customer-preview: keeps the real brand colors when the admin previews it
    <div className="customer-preview fixed inset-0 z-[9000] font-body text-ink md:flex md:items-center md:justify-center md:p-6">
      {/* Backdrop (desktop; the sheet covers the whole phone screen) */}
      <div
        className={`absolute inset-0 hidden bg-ink/60 backdrop-blur-sm transition-opacity duration-300 md:block ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-dvh w-full flex-col overflow-hidden bg-bg transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:grid md:h-[min(740px,calc(100dvh-48px))] md:max-w-[1000px] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:rounded-[2rem] md:shadow-[0_40px_80px_-30px_var(--color-ink)] ${entered
          ? 'translate-y-0 md:scale-100 md:opacity-100'
          : 'translate-y-full md:translate-y-0 md:scale-95 md:opacity-0'
          }`}
      >
        {/* ── Stage: the cup ───────────────────────────────────────────── */}
        <section className="relative flex h-[clamp(250px,40dvh,340px)] shrink-0 flex-col overflow-hidden bg-primary text-surface md:h-auto">
          {BUBBLES.map(([left, size, delay], i) => (
            <span
              key={i}
              className="bubble"
              style={{ left: `${left}%`, width: size, height: size, animationDelay: `${delay}s` }}
              aria-hidden="true"
            />
          ))}

          <header className="relative z-10 flex items-center justify-between gap-2 px-3 pt-3 md:px-5 md:pt-5">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface/15 transition hover:bg-surface/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X size={20} />
            </button>
            <h2 id={titleId} className="min-w-0 truncate font-display text-xl font-semibold md:text-2xl">
              {config.title}
            </h2>
            <button
              type="button"
              onClick={surprise}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-bold text-ink shadow-[0_8px_18px_-10px_var(--color-ink)] transition active:scale-95 hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-surface"
            >
              <Dices size={18} />
              <span>Sorpréndeme</span>
            </button>
          </header>

          <p className="relative z-10 hidden px-5 pt-2 text-center text-sm text-surface/75 md:block">
            {config.tagline}
          </p>

          <div className="relative z-10 flex min-h-0 flex-1 items-end justify-center pb-8 pt-2 md:items-center md:pb-10">
            <div className="relative h-full max-h-[420px] min-h-0">
              <DrinkCup
                ref={cupRef}
                visual={visual}
                label={isEmpty ? 'Vaso vacío' : `Tu bebida: ${chosenNames.join(', ')}`}
              />
              {isEmpty && (
                <p className="pointer-events-none absolute inset-x-0 top-[52%] flex justify-center">
                  <span className="rounded-full bg-ink/45 px-3 py-1 font-display text-sm font-medium text-surface backdrop-blur-sm">
                    Empieza aquí
                  </span>
                </p>
              )}
              {/* Price sticker */}
              <span
                key={total}
                className="builder-pop absolute -right-12 top-[18%] inline-flex rotate-[8deg] items-center rounded-2xl bg-surface px-3 py-1.5 font-display text-lg font-semibold text-primary shadow-[0_10px_20px_-10px_var(--color-ink)] tabular-nums md:-right-16 md:text-xl"
              >
                {money(total)}
              </span>
            </div>
          </div>
          <span className="sr-only" aria-live="polite">{`Total ${money(total)}`}</span>

          {/* Wavy edge into the panel (phones) */}
          <svg
            className="absolute bottom-0 left-0 block h-6 w-full text-bg md:hidden"
            viewBox="0 0 400 32"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 18 C 50 4, 100 4, 150 16 S 250 30, 300 16 S 370 4, 400 14 L400 32 L0 32 Z" fill="currentColor" />
          </svg>
        </section>

        {/* ── Panel: steps ─────────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-1 flex-col">
          {/* Step chips: progress + jump to any step */}
          <nav aria-label="Pasos" className="shrink-0 border-b border-primary/10">
            <ol ref={chipsRef} className="relative flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide md:px-6">
              {[...steps, { id: '__summary', name: 'Listo' }].map((s, i) => {
                const isCurrent = i === index
                const done = i < summaryIndex && selectedOptionsOf(s, selections).length > 0
                return (
                  <li key={s.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full pl-1.5 pr-3.5 text-sm font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-95 ${isCurrent
                        ? 'bg-primary text-surface shadow-[0_6px_16px_-6px_var(--color-primary)]'
                        : 'bg-surface text-ink-soft ring-1 ring-primary/10 hover:text-primary'
                        }`}
                    >
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs ${isCurrent ? 'bg-surface/20' : done ? 'bg-matcha text-matcha-ink' : 'bg-bg'
                          }`}
                        aria-hidden="true"
                      >
                        {done && !isCurrent ? <Check size={14} strokeWidth={3} /> : i === summaryIndex ? <Sparkles size={13} /> : i + 1}
                      </span>
                      {s.name}
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-5 md:px-6">
            <div key={index} className={direction === 'next' ? 'builder-step-next' : 'builder-step-back'}>
              {step ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
                      Paso {index + 1} de {steps.length}
                    </span>
                    <span className="rounded-full bg-mango px-2.5 py-0.5 text-xs font-bold text-mango-ink">
                      {ruleLabel(step)}
                    </span>
                  </div>
                  <h3 className="mt-1.5 font-display text-[1.7rem] font-semibold leading-tight">{step.name}</h3>
                  {step.hint && <p className="mt-1 text-[0.95rem] text-ink-soft">{step.hint}</p>}

                  <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3" role="group" aria-label={step.name}>
                    {step.options.map((o, i) => {
                      const selected = (selections[step.id] || []).includes(o.id)
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => pick(o)}
                          aria-pressed={selected}
                          className={`relative flex min-h-[96px] cursor-pointer flex-col items-start gap-2 rounded-3xl bg-surface p-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.97] ${selected
                            ? `ring-[2.5px] ring-primary shadow-[0_12px_24px_-14px_var(--color-primary)] ${lastPicked === o.id ? 'builder-pop' : ''}`
                            : 'ring-1 ring-primary/10 hover:ring-primary/30 hover:-translate-y-0.5'
                            }`}
                        >
                          <Swatch visual={step.visual} color={o.color} index={i} />
                          <span className="font-display text-base font-semibold leading-tight">{o.name}</span>
                          {o.desc && <span className="line-clamp-2 text-xs leading-snug text-ink-soft">{o.desc}</span>}
                          <span className={`mt-auto text-xs font-bold ${o.priceModifier ? 'text-primary' : 'text-ink-soft'}`}>
                            {o.priceModifier ? `+${money(o.priceModifier)}` : 'Incluido'}
                          </span>
                          <span
                            className={`absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-surface transition-all duration-200 ${selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
                            aria-hidden="true"
                          >
                            <Check size={14} strokeWidth={3} />
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {step.maxSelections && (selections[step.id] || []).length >= step.maxSelections && (
                    <p className="mt-3 text-sm text-ink-soft">
                      Ya elegiste {step.maxSelections}. Si tocas otro, cambia por el primero que elegiste.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">Último paso</span>
                  <h3 className="mt-1.5 font-display text-[1.7rem] font-semibold leading-tight">
                    {isEmpty ? 'Tu vaso sigue vacío' : '¡Tu creación está lista!'}
                  </h3>

                  <label htmlFor={`${titleId}-name`} className="mt-5 block text-sm font-bold">
                    Ponle nombre <span className="font-normal text-ink-soft">(opcional)</span>
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id={`${titleId}-name`}
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                      maxLength={NAME_MAX}
                      placeholder="Ej. Nube de la tarde"
                      autoComplete="off"
                      className="min-h-[48px] min-w-0 flex-1 rounded-2xl bg-surface px-4 font-display text-base font-medium ring-1 ring-primary/15 placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => setName(suggestName(live, selections))}
                      disabled={isEmpty}
                      aria-label="Sugerir otro nombre"
                      title="Otra idea"
                      className="inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-taro text-taro-ink transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <WandSparkles size={20} />
                    </button>
                  </div>

                  <dl className="mt-5 divide-y divide-dashed divide-primary/15 rounded-3xl bg-surface px-4 ring-1 ring-primary/10">
                    {steps.map((s, i) => {
                      const chosen = selectedOptionsOf(s, selections)
                      const lacking = s.required && chosen.length === 0
                      return (
                        <div key={s.id} className="flex items-center gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <dt className="text-xs font-bold uppercase tracking-wider text-ink-soft">{s.name}</dt>
                            <dd className={`mt-0.5 text-[0.95rem] font-semibold ${lacking ? 'text-fresa-ink' : ''}`}>
                              {chosen.length
                                ? chosen.map((o) => (o.priceModifier ? `${o.name} (+${money(o.priceModifier)})` : o.name)).join(', ')
                                : lacking ? 'Falta elegir' : 'Sin agregar'}
                            </dd>
                          </div>
                          <button
                            type="button"
                            onClick={() => goTo(i)}
                            aria-label={`Cambiar ${s.name}`}
                            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary transition hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                      )
                    })}
                  </dl>

                  <div className="mt-5 flex items-center justify-between rounded-3xl bg-surface px-4 py-2 ring-1 ring-primary/10">
                    <span className="text-sm font-bold">¿Cuántas?</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        disabled={qty <= 1}
                        aria-label="Menos"
                        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-bg text-primary transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus size={18} />
                      </button>
                      <span className="min-w-6 text-center font-display text-xl font-semibold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty((q) => q + 1)}
                        aria-label="Más"
                        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-primary text-surface transition active:scale-90"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Bottom bar ─────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-primary/10 bg-bg px-4 pt-3 pb-safe md:px-6 md:pb-5">
            <div className="flex items-center gap-3">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  aria-label="Paso anterior"
                  className="inline-flex h-[52px] w-[52px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-primary ring-1 ring-primary/15 transition active:scale-95 hover:ring-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              {onSummary ? (
                <button
                  type="button"
                  onClick={addToCart}
                  className="inline-flex min-h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 font-display text-lg font-semibold text-surface shadow-[0_12px_24px_-12px_var(--color-primary)] transition hover:bg-secondary active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {missing === -1
                    ? <>Agregar · <span className="tabular-nums">{money(total * qty)}</span></>
                    : <>Falta: {steps[missing].name}</>}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  disabled={!stepDone}
                  className="inline-flex min-h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 font-display text-lg font-semibold text-surface shadow-[0_12px_24px_-12px_var(--color-primary)] transition hover:bg-secondary active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-primary/15 disabled:text-ink-soft disabled:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {stepDone
                    ? <>{nextStep ? `Sigue: ${nextStep.name}` : 'Ver mi bebida'} <ArrowRight size={20} /></>
                    : `Elige tu ${step.name.toLowerCase()}`}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body
  )
}

DrinkBuilder.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  config: PropTypes.shape({
    title: PropTypes.string.isRequired,
    tagline: PropTypes.string,
    basePrice: PropTypes.number.isRequired,
    steps: PropTypes.array.isRequired,
  }).isRequired,
  onAdd: PropTypes.func.isRequired,
}
