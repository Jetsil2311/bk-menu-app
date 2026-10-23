/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore'
import {
  ArrowDown, ArrowUp, Ban, ChevronDown, CircleDot, Cloud, CupSoda, Dices, Droplet, GitBranch, ListChecks, Package,
  Pencil, Play, Plus, Settings2, Snowflake, Trash2, TriangleAlert, Wallet, X,
} from 'lucide-react'
import { auth, db } from '../../../firebase'
import { formatMoney } from '../../../utils/cart'
import {
  DRINK_RECIPE_ID, VISUAL_OPTIONS, cleanDraft, configFromDraft, createDraftOption, createDraftStep,
  describeCondition, draftFromDocs, drinkRanges, hasCondition, linesCost, recipeFromDraft, toggleCondition, validateDraft,
} from '../../../utils/drinkBuilderAdmin'
import { deriveCupVisual, normalizeBuilderConfig, randomSelections } from '../../../utils/drinkBuilder'
import { DrinkCup } from '../../drinkBuilder/DrinkCup'
import { DrinkBuilder } from '../../drinkBuilder/DrinkBuilder'
import { ConfirmDialog } from '../ConfirmDialog'
import {
  ChipCheck, Drawer, EmptyState, Field, FormSection, MiniSwitch, Notice, Segmented, Toggle,
  btnPrimary, btnSecondary, iconBtn, iconBtnDanger, inputCls, textareaCls,
} from '../ui'
import { InventoryRows } from './InventoryRows'

const VISUAL_ICONS = { liquid: Droplet, pearls: CircleDot, foam: Cloud, ice: Snowflake, none: Ban }

// Color presets come from the menu's own tokens, read at runtime.
const PRESET_TOKENS = [
  '--color-surface', '--color-latte', '--color-taro', '--color-matcha', '--color-fresa',
  '--color-mango', '--color-accent', '--color-secondary', '--color-ink',
]
const readPresets = () => {
  if (typeof window === 'undefined') return []
  const cs = getComputedStyle(document.documentElement)
  return [...new Set(PRESET_TOKENS.map((t) => cs.getPropertyValue(t).trim()).filter((v) => /^#[0-9a-f]{6}$/i.test(v)))]
}

const ICE_LEVELS = [
  { value: 0, label: 'Nada' },
  { value: 0.5, label: 'Poco' },
  { value: 1, label: 'Normal' },
]

const money = (n) => formatMoney(n).replace(/\.00$/, '')
const range = (a, b) => (a === b ? money(a) : `${money(a)} – ${money(b)}`)
const marginOf = (price, cost) => (price > 0 ? Math.round(((price - cost) / price) * 100) : null)

const ruleText = (s) => {
  const kind = s.type === 'single' ? 'Elige 1' : Number(s.maxSelections) > 0 ? `Hasta ${s.maxSelections}` : 'Elige varios'
  return `${kind} · ${s.required ? 'Obligatorio' : 'Opcional'}`
}

// ── "Solo si…" rule: pick options from earlier steps ─────────────────────────
// `allSteps` names the rule even when it points at a step that was moved
// after this one (save is blocked until it's fixed — see validateDraft).
const ConditionPicker = ({ value, earlierSteps, allSteps, onChange }) => {
  const [open, setOpen] = useState(() => hasCondition(value))
  const steps = earlierSteps.filter((s) => s.options.some((o) => o.name.trim()))
  const summary = describeCondition(value, allSteps)
  const misplaced = Object.keys(value).some((id) => value[id]?.length && !earlierSteps.some((s) => s.id === id))

  if (!steps.length && !summary) {
    return <p className="text-sm text-light-200/70">Para ponerle condición, tiene que haber un paso antes de este.</p>
  }
  if (!open && !summary) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnSecondary}>
        <GitBranch size={16} /> Agregar condición
      </button>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-light-200/70">
        Marca lo que el cliente tiene que haber elegido antes. Del mismo paso basta con uno; si marcas en varios pasos,
        tiene que cumplir todos.
      </p>
      {steps.map((s) => (
        <div key={s.id}>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-light-200/65">{s.name || 'Paso sin nombre'}</p>
          <div className="flex flex-wrap gap-2">
            {s.options.filter((o) => o.name.trim()).map((o) => (
              <ChipCheck
                key={o.id}
                checked={(value[s.id] || []).includes(o.id)}
                onChange={() => onChange(toggleCondition(value, s.id, o.id))}
              >
                {o.name}
              </ChipCheck>
            ))}
          </div>
        </div>
      ))}
      {misplaced && (
        <p className="flex items-start gap-2 text-sm text-amber-400">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          Depende de un paso que ahora va después de este. Súbelo o quita la condición.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-main-800 px-3 py-2.5 text-sm">
        <span className="text-light-200/80">
          {summary
            ? <>Solo se muestra si el cliente eligió <b className="text-light-100">{summary}</b>.</>
            : 'Sin condición: siempre se muestra.'}
        </span>
        <button
          type="button"
          onClick={() => { onChange({}); setOpen(false) }}
          className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-bold text-light-200/80 hover:bg-white/5"
        >
          <X size={14} /> {summary ? 'Quitar condición' : 'Cerrar'}
        </button>
      </div>
    </div>
  )
}

// ── One ingredient inside a step ─────────────────────────────────────────────
const OptionCard = ({ step, option, index, count, materials, presets, earlierSteps, allSteps, open, onToggleOpen, onChange, onMove, onRemove }) => {
  const cost = linesCost(option.ingredients, materials)
  const price = Number(option.priceModifier) || 0
  const usesColor = ['liquid', 'pearls', 'foam'].includes(step.visual)
  const set = (patch) => onChange({ ...option, ...patch })
  const onlyWith = describeCondition(option.showIf, allSteps)

  return (
    <div className={`rounded-2xl border bg-main-900 transition-colors ${open ? 'border-primary/40' : 'border-white/10'} ${option.isActive ? '' : 'opacity-70'}`}>
      <div className="flex items-center gap-2 p-2 pl-3">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <span
            className="h-8 w-8 shrink-0 rounded-full ring-1 ring-white/15"
            style={{ background: option.color || 'var(--color-main-800)' }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-light-100">{option.name || 'Ingrediente sin nombre'}</span>
            <span className="block text-xs text-light-200/70 tabular-nums">
              {price ? `+${money(price)}` : 'Incluido'} · costo {money(cost)}
              {!option.ingredients.length && <span className="text-amber-400"> · sin inventario</span>}
            </span>
            {onlyWith && (
              <span className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-light-200/80">
                <GitBranch size={12} className="shrink-0" /> Solo con {onlyWith}
              </span>
            )}
          </span>
          <ChevronDown size={18} className={`shrink-0 text-light-200/60 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <MiniSwitch checked={option.isActive} onChange={(v) => set({ isActive: v })} label={option.isActive ? 'Disponible' : 'Agotado'} />
      </div>

      {open && (
        <div className="space-y-4 border-t border-white/10 p-3.5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Field label="Nombre" required htmlFor={`o-name-${option.id}`}>
              <input id={`o-name-${option.id}`} value={option.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. Taro" className={inputCls} />
            </Field>
            <Field label="Precio extra" htmlFor={`o-price-${option.id}`} hint="0 = incluido">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-light-200/60">$</span>
                <input
                  id={`o-price-${option.id}`}
                  type="number" inputMode="decimal" min="0" step="any"
                  value={option.priceModifier}
                  onChange={(e) => set({ priceModifier: e.target.value })}
                  placeholder="0"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>
          </div>
          <Field label="Descripción corta" htmlFor={`o-desc-${option.id}`} hint="Opcional. Una línea, se ve debajo del nombre.">
            <input id={`o-desc-${option.id}`} value={option.desc} onChange={(e) => set({ desc: e.target.value })} maxLength={60} placeholder="Ej. Revientan en tu boca." className={inputCls} />
          </Field>

          {usesColor && (
            <Field label="Color en el vaso" hint="Así se pinta en la animación.">
              <div className="flex flex-wrap items-center gap-2">
                {presets.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set({ color: c })}
                    aria-label={`Color ${c}`}
                    aria-pressed={option.color === c}
                    className={`h-9 w-9 cursor-pointer rounded-full ring-1 ring-white/20 transition ${option.color === c ? 'ring-[3px] ring-primary' : ''}`}
                    style={{ background: c }}
                  />
                ))}
                <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3 text-sm font-semibold text-light-100">
                  <input
                    type="color"
                    value={option.color || '#ffffff'}
                    onChange={(e) => set({ color: e.target.value })}
                    className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  Otro
                </label>
              </div>
            </Field>
          )}

          <Field label="Solo se puede elegir si…" hint="Ej. «Taro» solo con base «Leche». Sin condición = siempre disponible.">
            <ConditionPicker
              value={option.showIf}
              earlierSteps={earlierSteps}
              allSteps={allSteps}
              onChange={(showIf) => set({ showIf })}
            />
          </Field>

          {step.visual === 'ice' && (
            <Field label="Cantidad de hielo que se dibuja">
              <Segmented
                ariaLabel="Cantidad de hielo"
                value={Number(option.amount)}
                onChange={(v) => set({ amount: v })}
                options={ICE_LEVELS}
              />
            </Field>
          )}

          <div>
            <p className="mb-1.5 text-sm font-bold text-light-100">Qué descuenta del inventario</p>
            <InventoryRows
              rows={option.ingredients}
              materials={materials}
              onChange={(ingredients) => set({ ingredients })}
            />
          </div>

          {/* Included choices are paid by the base price; extras should pay for themselves. */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-main-800 px-3 py-2.5 text-sm">
            {price > 0 ? (
              <>
                <span className="text-light-200/80">
                  Cobras <b className="text-light-100 tabular-nums">+{money(price)}</b> · te cuesta{' '}
                  <b className="text-light-100 tabular-nums">{money(cost)}</b>
                </span>
                <span className={`font-bold tabular-nums ${price < cost ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {price < cost ? `El extra no cubre su costo (−${money(cost - price)})` : `Ganas ${money(price - cost)}`}
                </span>
              </>
            ) : (
              <span className="text-light-200/80">
                Incluido en el precio base · te cuesta <b className="text-light-100 tabular-nums">{money(cost)}</b>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Subir" className={iconBtn}><ArrowUp size={16} /></button>
              <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Bajar" className={iconBtn}><ArrowDown size={16} /></button>
            </div>
            <button type="button" onClick={onRemove} className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-rose-400 hover:bg-rose-500/10">
              <Trash2 size={15} /> Quitar ingrediente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Drawer: edit one step and its ingredients ────────────────────────────────
const StepDrawer = ({ step, stepNumber, allSteps, materials, presets, onChange, onClose }) => {
  const earlierSteps = allSteps.slice(0, stepNumber - 1)
  const [openOption, setOpenOption] = useState(() => (step.options.length === 1 && !step.options[0].name ? step.options[0].id : null))
  const set = (patch) => onChange({ ...step, ...patch })
  const setOption = (i, option) => set({ options: step.options.map((o, j) => (j === i ? option : o)) })
  const moveOption = (i, dir) => {
    const next = [...step.options]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    set({ options: next })
  }
  const addOption = () => {
    const o = createDraftOption()
    set({ options: [...step.options, o] })
    setOpenOption(o.id)
  }

  return (
    <Drawer
      isOpen
      wide
      onClose={onClose}
      title={step.name || `Paso ${stepNumber}`}
      subtitle="Los cambios se guardan con «Guardar cambios»"
      footer={<button type="button" onClick={onClose} className={`${btnPrimary} w-full`}>Listo</button>}
    >
      <div className="space-y-4">
        <FormSection icon={Settings2} title="El paso" hint="Cómo se llama y qué puede elegir el cliente.">
          <Field label="Nombre del paso" required htmlFor="step-name">
            <input id="step-name" value={step.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. Sabor" className={inputCls} />
          </Field>
          <Field label="Frase de ayuda" htmlFor="step-hint" hint="Opcional. Aparece debajo del título.">
            <textarea id="step-hint" rows={2} value={step.hint} onChange={(e) => set({ hint: e.target.value })} placeholder="Ej. Mezcla hasta dos. Sí, se vale." className={textareaCls} />
          </Field>
          <Field label="¿Cuántos puede elegir?">
            <Segmented
              ariaLabel="Cuántos puede elegir"
              value={step.type}
              onChange={(v) => set({ type: v })}
              options={[{ value: 'single', label: 'Solo 1' }, { value: 'multi', label: 'Varios' }]}
            />
          </Field>
          {step.type === 'multi' && (
            <Field label="Máximo" htmlFor="step-max" hint="Vacío = los que quiera.">
              <input id="step-max" type="number" inputMode="numeric" min="1" step="1" value={step.maxSelections} onChange={(e) => set({ maxSelections: e.target.value })} placeholder="Sin límite" className={`${inputCls} max-w-[160px]`} />
            </Field>
          )}
          <Toggle
            checked={step.required}
            onChange={(v) => set({ required: v })}
            label="Obligatorio"
            hint="El cliente no puede seguir sin elegir algo aquí."
          />
          <Field label="Cómo se ve en el vaso">
            <div role="radiogroup" aria-label="Cómo se ve en el vaso" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VISUAL_OPTIONS.map((v) => {
                const Icon = VISUAL_ICONS[v.value]
                const active = step.visual === v.value
                return (
                  <button
                    key={v.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set({ visual: v.value })}
                    className={`flex min-h-[64px] cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${active ? 'border-primary bg-primary/10' : 'border-white/15 hover:border-primary/40'}`}
                  >
                    <Icon size={18} className={`mt-0.5 shrink-0 ${active ? 'text-primary dark:text-main-300' : 'text-light-200/70'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-light-100">{v.label}</span>
                      <span className="block text-xs leading-snug text-light-200/70">{v.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Field>
        </FormSection>

        <FormSection
          icon={GitBranch}
          title="Cuándo aparece"
          hint="Ej. «Hielo» solo si la bebida es fría. Si no se cumple, el cliente se salta este paso."
        >
          <ConditionPicker
            value={step.showIf}
            earlierSteps={earlierSteps}
            allSteps={allSteps}
            onChange={(showIf) => set({ showIf })}
          />
        </FormSection>

        <FormSection
          icon={ListChecks}
          title="Ingredientes"
          hint="Precio extra que cobras y la materia prima que se descuenta cuando se paga la bebida."
        >
          <div className="space-y-2">
            {step.options.map((o, i) => (
              <OptionCard
                key={o.id}
                step={step}
                option={o}
                index={i}
                count={step.options.length}
                materials={materials}
                presets={presets}
                earlierSteps={earlierSteps}
                allSteps={allSteps}
                open={openOption === o.id}
                onToggleOpen={() => setOpenOption(openOption === o.id ? null : o.id)}
                onChange={(next) => setOption(i, next)}
                onMove={(dir) => moveOption(i, dir)}
                onRemove={() => set({ options: step.options.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
          <button type="button" onClick={addOption} className={`${btnSecondary} w-full`}>
            <Plus size={16} /> Agregar ingrediente
          </button>
        </FormSection>
      </div>
    </Drawer>
  )
}

// ── Main tab ─────────────────────────────────────────────────────────────────
export const DrinkBuilderEditor = ({ notify }) => {
  const [savedConfig, setSavedConfig] = useState(undefined)
  const [savedRecipe, setSavedRecipe] = useState(undefined)
  const [materials, setMaterials] = useState([])
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingStep, setEditingStep] = useState(null)
  const [deleteStep, setDeleteStep] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sampleSeed, setSampleSeed] = useState(0)
  const presets = useMemo(readPresets, [])

  useEffect(() => {
    const unsubs = [
      onSnapshot(doc(db, 'settings', 'drinkBuilder'),
        (snap) => setSavedConfig(snap.exists() ? snap.data() : null),
        () => setSavedConfig(null)),
      onSnapshot(doc(db, 'recipes', DRINK_RECIPE_ID),
        (snap) => setSavedRecipe(snap.exists() ? snap.data() : null),
        () => setSavedRecipe(null)),
      onSnapshot(collection(db, 'rawMaterials'),
        (snap) => setMaterials(snap.docs.map((d) => ({ docId: d.id, ...d.data() }))),
        () => setMaterials([])),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  // Follow what's saved until the owner starts editing.
  useEffect(() => {
    if (dirty || savedConfig === undefined || savedRecipe === undefined) return
    setDraft(draftFromDocs(savedConfig, savedRecipe))
  }, [savedConfig, savedRecipe, dirty])

  const edit = (fn) => {
    setDraft((d) => fn(structuredClone(d)))
    setDirty(true)
    setError('')
  }

  const previewConfig = useMemo(
    () => (draft ? normalizeBuilderConfig({ ...configFromDraft(cleanDraft(draft)), enabled: true }) : null),
    [draft]
  )
  // A sample drink for the little cup (changes with "Otra combinación").
  const sampleVisual = useMemo(() => {
    if (!previewConfig) return { liquids: [], pearls: [], foam: null, ice: null }
    return deriveCupVisual(previewConfig, randomSelections(previewConfig))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewConfig, sampleSeed])

  if (!draft) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-main-900" />)}
      </div>
    )
  }

  const ranges = drinkRanges(draft, materials)
  const baseCost = linesCost(draft.baseIngredients, materials)
  const missingInventory = draft.steps.reduce(
    (n, s) => n + s.options.filter((o) => o.name.trim() && !o.ingredients.length).length, 0
  )

  const save = async () => {
    const problem = validateDraft(draft)
    if (problem) {
      setError(problem.message)
      if (problem.stepIndex != null) setEditingStep(problem.stepIndex)
      return
    }
    const clean = cleanDraft(draft)
    setSaving(true)
    try {
      // One atomic write: the menu and its inventory recipe never disagree.
      const batch = writeBatch(db)
      batch.set(doc(db, 'settings', 'drinkBuilder'), { ...configFromDraft(clean), updatedAt: serverTimestamp() })
      batch.set(doc(db, 'recipes', DRINK_RECIPE_ID), {
        ...recipeFromDraft(clean, materials),
        createdAt: savedRecipe?.createdAt ?? serverTimestamp(),
        lastUpdated: serverTimestamp(),
        updatedBy: auth.currentUser?.email || '',
      })
      await batch.commit()
      setDirty(false)
      notify?.('Arma tu bebida guardado')
    } catch (err) {
      setError(err?.code === 'permission-denied'
        ? 'No se pudo guardar: tu base de datos no permite guardar recetas todavía. Hay que publicar las reglas de Firestore (recipes) — ver digitalMenu.md.'
        : 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setDirty(false)
    setError('')
  }

  const moveStep = (i, dir) => edit((d) => {
    const j = i + dir
    if (j >= 0 && j < d.steps.length) [d.steps[i], d.steps[j]] = [d.steps[j], d.steps[i]]
    return d
  })

  const addStep = () => {
    edit((d) => { d.steps.push(createDraftStep()); return d })
    setEditingStep(draft.steps.length)
  }

  const isNew = savedConfig === null
  const dependsOn = (stepId) => draft.steps.some(
    (s) => s.showIf[stepId]?.length || s.options.some((o) => o.showIf[stepId]?.length)
  )

  return (
    <div className="space-y-5 pb-4">
      {/* ── Overview ─────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-main-900">
        <div className="flex flex-col sm:flex-row">
          <div className="customer-preview relative flex items-center justify-center bg-primary px-6 py-5 sm:w-56">
            <div className="h-40">
              <DrinkCup visual={sampleVisual} label="Ejemplo de bebida" size="sm" />
            </div>
            {previewConfig && (
              <button
                type="button"
                onClick={() => setSampleSeed((n) => n + 1)}
                aria-label="Otra combinación"
                title="Otra combinación"
                className="absolute bottom-2 right-2 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-surface/15 text-surface transition hover:bg-surface/25"
              >
                <Dices size={18} />
              </button>
            )}
          </div>
          <div className="flex-1 space-y-4 p-4 sm:p-5">
            <div>
              <h2 className="font-display text-2xl font-semibold text-light-100">Arma tu bebida</h2>
              <p className="mt-1 text-sm text-light-200/75">
                Tus clientes crean su bebida paso a paso. Aquí defines los pasos, cuánto cobras por cada ingrediente
                y cuánta materia prima gasta. Al pagarse la bebida, se descuenta del inventario.
              </p>
            </div>
            <Toggle
              checked={draft.enabled}
              onChange={(v) => edit((d) => { d.enabled = v; return d })}
              label="Mostrar en el menú"
              hint={draft.enabled ? 'Visible para los clientes al guardar.' : 'Oculto: los clientes no lo ven.'}
            />
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-main-800 px-2 py-2.5">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-light-200/65">Precio</dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-light-100">{range(ranges.minPrice, ranges.maxPrice)}</dd>
              </div>
              <div className="rounded-xl bg-main-800 px-2 py-2.5">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-light-200/65">Costo</dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-light-100">{range(ranges.minCost, ranges.maxCost)}</dd>
              </div>
              <div className="rounded-xl bg-main-800 px-2 py-2.5">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-light-200/65">Margen</dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-light-100">
                  {(() => {
                    const a = marginOf(ranges.minPrice, ranges.minCost)
                    const b = marginOf(ranges.maxPrice, ranges.maxCost)
                    if (a == null) return '—'
                    return a === b ? `${a}%` : `${Math.min(a, b)}–${Math.max(a, b)}%`
                  })()}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPreviewOpen(true)} disabled={!previewConfig} className={btnSecondary}>
                <Play size={16} /> Probar como cliente
              </button>
            </div>
            {missingInventory > 0 && (
              <p className="flex items-start gap-2 text-sm text-amber-400">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                {missingInventory === 1 ? '1 ingrediente no descuenta' : `${missingInventory} ingredientes no descuentan`} nada del inventario todavía.
              </p>
            )}
          </div>
        </div>
      </section>

      {isNew && draft.steps.length === 0 && (
        <EmptyState
          icon={CupSoda}
          title="Empieza con tu primer paso"
          action={<button type="button" onClick={addStep} className={btnPrimary}><Plus size={16} /> Agregar paso</button>}
        >
          Por ejemplo: Base (leche, agua), Sabor, Perlas, Toque final. Cada paso tiene sus ingredientes.
        </EmptyState>
      )}

      {/* ── General ──────────────────────────────────────────────────── */}
      <FormSection icon={Wallet} title="Precio y textos" hint="Lo que el cliente ve primero.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título" htmlFor="db-title" hint="Vacío = «Arma tu bebida».">
            <input id="db-title" value={draft.title} onChange={(e) => edit((d) => { d.title = e.target.value; return d })} placeholder="Arma tu bebida" className={inputCls} />
          </Field>
          <Field label="Precio base" htmlFor="db-price" hint="Lo que cuesta antes de elegir ingredientes con precio extra.">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-light-200/60">$</span>
              <input id="db-price" type="number" inputMode="decimal" min="0" step="any" value={draft.basePrice} onChange={(e) => edit((d) => { d.basePrice = e.target.value; return d })} placeholder="0" className={`${inputCls} pl-7`} />
            </div>
          </Field>
        </div>
        <Field label="Frase" htmlFor="db-tagline" hint="Una línea debajo del título.">
          <input id="db-tagline" value={draft.tagline} onChange={(e) => edit((d) => { d.tagline = e.target.value; return d })} placeholder="Tú eliges cada capa. Nosotros la preparamos." className={inputCls} />
        </Field>
      </FormSection>

      <FormSection
        icon={Package}
        title="Siempre se usa"
        hint="Vaso, tapa, popote… Se descuenta en cada bebida, elija lo que elija."
      >
        <InventoryRows
          rows={draft.baseIngredients}
          materials={materials}
          onChange={(rows) => edit((d) => { d.baseIngredients = rows; return d })}
          emptyLabel="Nada todavía."
        />
        {baseCost > 0 && Number(draft.basePrice) > 0 && (
          <p className="text-xs text-light-200/70">
            Base: cobras {money(Number(draft.basePrice))}, te cuesta {money(baseCost)}.
          </p>
        )}
      </FormSection>

      {/* ── Steps ────────────────────────────────────────────────────── */}
      {draft.steps.length > 0 && (
        <FormSection
          icon={ListChecks}
          title="Pasos"
          hint="En este orden los recorre el cliente."
          action={<button type="button" onClick={addStep} className={btnSecondary}><Plus size={16} /> Paso</button>}
        >
          <ol className="space-y-2">
            {draft.steps.map((s, i) => {
              const Icon = VISUAL_ICONS[s.visual] || Ban
              const named = s.options.filter((o) => o.name.trim())
              const active = named.filter((o) => o.isActive)
              const noInv = named.filter((o) => !o.ingredients.length).length
              const prices = active.map((o) => Number(o.priceModifier) || 0)
              const onlyIf = describeCondition(s.showIf, draft.steps)
              const conditional = active.filter((o) => describeCondition(o.showIf, draft.steps)).length
              return (
                <li key={s.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-main-900 p-2 pl-3">
                  <button
                    type="button"
                    onClick={() => setEditingStep(i)}
                    className="flex min-h-[52px] min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-main-300">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-light-100">
                        {i + 1}. {s.name || 'Paso sin nombre'}
                      </span>
                      <span className="block truncate text-xs text-light-200/70">
                        {ruleText(s)} · {active.length} {active.length === 1 ? 'ingrediente' : 'ingredientes'}
                        {prices.length ? ` · ${prices.some(Boolean) ? `+${range(Math.min(...prices), Math.max(...prices))}` : 'incluidos'}` : ''}
                      </span>
                      {(onlyIf || conditional > 0) && (
                        <span className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-light-200/80">
                          <GitBranch size={12} className="shrink-0" />
                          {[
                            onlyIf && `Solo si eligió ${onlyIf}`,
                            conditional > 0 && `${conditional} con condición`,
                          ].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      {noInv > 0 && (
                        <span className="mt-0.5 block text-xs font-semibold text-amber-400">{noInv} sin inventario</span>
                      )}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center">
                    <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label={`Subir ${s.name}`} className={`${iconBtn} hidden sm:inline-flex`}><ArrowUp size={16} /></button>
                    <button type="button" onClick={() => moveStep(i, 1)} disabled={i === draft.steps.length - 1} aria-label={`Bajar ${s.name}`} className={`${iconBtn} hidden sm:inline-flex`}><ArrowDown size={16} /></button>
                    <button type="button" onClick={() => setEditingStep(i)} aria-label={`Editar ${s.name}`} className={iconBtn}><Pencil size={16} /></button>
                    <button type="button" onClick={() => setDeleteStep(i)} aria-label={`Eliminar ${s.name}`} className={iconBtnDanger}><Trash2 size={16} /></button>
                  </div>
                </li>
              )
            })}
          </ol>
        </FormSection>
      )}

      {/* ── Save bar ─────────────────────────────────────────────────── */}
      {(dirty || error) && (
        <div className="sticky bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 space-y-2 md:bottom-4">
          {error && <Notice tone="error" icon={TriangleAlert}>{error}</Notice>}
          {dirty && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-main-900 p-2.5 pl-4 shadow-[0_18px_40px_-20px_var(--color-ink)]">
              <p className="min-w-0 flex-1 text-sm font-bold text-light-100">Cambios sin guardar</p>
              <button type="button" onClick={discard} disabled={saving} className={btnSecondary}>Descartar</button>
              <button type="button" onClick={save} disabled={saving} className={btnPrimary}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>
      )}

      {editingStep != null && draft.steps[editingStep] && (
        <StepDrawer
          key={draft.steps[editingStep].id}
          step={draft.steps[editingStep]}
          stepNumber={editingStep + 1}
          allSteps={draft.steps}
          materials={materials}
          presets={presets}
          onChange={(next) => edit((d) => { d.steps[editingStep] = next; return d })}
          onClose={() => setEditingStep(null)}
        />
      )}

      {deleteStep != null && draft.steps[deleteStep] && (
        <ConfirmDialog
          title={`¿Eliminar «${draft.steps[deleteStep].name || 'este paso'}»?`}
          message={`Se quitan el paso y sus ingredientes${dependsOn(draft.steps[deleteStep].id) ? ', y las condiciones que dependen de él' : ''}. No se borra nada hasta que toques «Guardar cambios».`}
          onCancel={() => setDeleteStep(null)}
          onConfirm={() => {
            edit((d) => {
              const [gone] = d.steps.splice(deleteStep, 1)
              // Drop rules that pointed at it (saving would drop them anyway).
              for (const s of d.steps) {
                delete s.showIf[gone.id]
                for (const o of s.options) delete o.showIf[gone.id]
              }
              return d
            })
            setDeleteStep(null)
          }}
        />
      )}

      {previewConfig && (
        <DrinkBuilder
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          config={previewConfig}
          onAdd={() => {
            setPreviewOpen(false)
            notify?.('Vista previa: no se agregó nada')
          }}
        />
      )}
    </div>
  )
}
