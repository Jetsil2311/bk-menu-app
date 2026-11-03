/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from 'react'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { AlertCircle, Check, ExternalLink, Search, Store, Undo2, UploadCloud, Wand2 } from 'lucide-react'
import { LandingPage } from '../Landing'
import { useLandingContent, landingDocRef } from '../../hooks/useLandingContent'
import { mergeLanding, setPath } from '../../config/landingContent'
import { dateKey, isClosedOn, openStatus, withPeriod } from '../../config/business'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { productImage } from '../../utils/productImage'
import { Drawer, Notice, Segmented, Toggle, Field, inputCls, textareaCls, btnPrimary, btnSecondary } from '../../components/admin/ui'

// Admin → Landing: the landing page itself, with every text as an input in
// place. Edits stay in a draft (also kept on this device) until "Publicar";
// "Cerrado hoy" is saved the moment it's switched.

const DRAFT_KEY = 'bk_landing_draft'

// Everything "Publicar" writes (closure is saved on its own).
const publishable = (c) => Object.fromEntries(Object.entries(c).filter(([key]) => key !== 'closure'))
const sameContent = (a, b) => JSON.stringify(publishable(a)) === JSON.stringify(publishable(b))

const readLocalDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? mergeLanding(JSON.parse(raw)) : null
  } catch { return null }
}
const writeLocalDraft = (draft) => {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(publishable(draft)))
    else localStorage.removeItem(DRAFT_KEY)
  } catch { /* private mode */ }
}

const validate = (c) => {
  if (!c.hours.days.length) return 'Elige al menos un día de apertura (en “Te vemos en…”).'
  if (c.hours.close <= c.hours.open) return 'La hora de cierre debe ser después de la de apertura.'
  return ''
}

// ── "Cerrado hoy" ────────────────────────────────────────────────────────────
const ClosureCard = ({ live, hours }) => {
  const closure = live.closure
  const closed = isClosedOn(closure)
  const today = dateKey()
  const [message, setMessage] = useState(closure.message)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const typing = useRef(false)

  // Follow the saved message unless the owner is typing one right now.
  useEffect(() => { if (!typing.current) setMessage(closure.message) }, [closure.message])

  const save = async (next) => {
    setSaving(true)
    setError('')
    try {
      await setDoc(landingDocRef(), { closure: { ...closure, ...next }, updatedAt: serverTimestamp() }, { merge: true })
    } catch {
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  // The message saves a moment after typing stops.
  useEffect(() => {
    if (!typing.current || message === closure.message) return undefined
    const t = setTimeout(() => { typing.current = false; save({ message: message.trim() }) }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message])

  const multiDay = closed && closure.until > today
  const preview = openStatus(new Date(), hours, { ...closure, message })

  return (
    <section
      aria-labelledby="closure-title"
      className={`rounded-2xl border p-4 sm:p-5 transition-colors ${closed ? 'border-rose-500/30 bg-rose-500/10' : 'border-white/10 bg-main-900'}`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${closed ? 'bg-rose-500/15 text-rose-400' : 'bg-primary/10 text-primary dark:text-main-300'}`}>
          <Store size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="closure-title" className="sr-only">Cerrado hoy</h2>
          <Toggle
            checked={closed}
            disabled={saving}
            onChange={(on) => save({ until: on ? today : '' })}
            label="Cerrado hoy"
            hint={closed
              ? 'La página de inicio y el menú avisan que hoy no abres. Se apaga solo cuando pasa el día.'
              : 'Préndelo si hoy no vas a abrir. Tus clientes lo verán arriba de la página y del menú.'}
          />
        </div>
      </div>

      {closed && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:pl-[3.25rem]">
          <Field label="¿Hasta cuándo?">
            <Segmented
              ariaLabel="Hasta cuándo está cerrado"
              value={multiDay ? 'range' : 'today'}
              onChange={(v) => save({ until: v === 'today' ? today : dateKey(new Date(Date.now() + 86_400_000)) })}
              options={[{ value: 'today', label: 'Solo hoy' }, { value: 'range', label: 'Varios días' }]}
            />
            {multiDay && (
              <label className="mt-3 block text-sm font-bold text-light-100">
                Cerrado hasta el (incluido)
                <input
                  type="date"
                  min={today}
                  value={closure.until}
                  onChange={(e) => e.target.value && save({ until: e.target.value })}
                  className={`${inputCls} mt-1.5`}
                />
              </label>
            )}
          </Field>
          <Field label="Mensaje para tus clientes" hint="Opcional. Ej. “Cerramos por inventario, ¡nos vemos mañana!”" htmlFor="closure-msg">
            <textarea
              id="closure-msg"
              rows={2}
              maxLength={160}
              value={message}
              onChange={(e) => { typing.current = true; setMessage(e.target.value) }}
              className={textareaCls}
            />
          </Field>
          <p className="text-sm text-light-200/80 sm:col-span-2" aria-live="polite">
            Se lee: <span className="font-bold text-light-100">“{withPeriod(preview.text)}{message.trim() ? ` ${message.trim()}` : ''}”</span>
            {saving && <span className="ml-2 text-light-200/60">Guardando…</span>}
          </p>
        </div>
      )}
      {error && <div className="mt-3"><Notice icon={AlertCircle}>{error}</Notice></div>}
    </section>
  )
}

// ── Pickers ──────────────────────────────────────────────────────────────────
const ProductPicker = ({ picker, onClose }) => {
  const [q, setQ] = useState('')
  const options = picker?.options || []
  const shown = q.trim() ? options.filter((p) => p.name?.toLowerCase().includes(q.trim().toLowerCase())) : options
  const pick = (id) => { picker.onPick(id); onClose() }
  const tile = (active) => `relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-colors cursor-pointer ${active ? 'border-primary dark:border-main-300' : 'border-white/10 hover:border-primary/40'}`
  return (
    <Drawer isOpen={Boolean(picker)} onClose={onClose} title={picker?.title || 'Elegir producto'} subtitle="Solo salen productos con foto y a la venta.">
      {options.length > 8 && (
        <label className="relative mb-4 block">
          <span className="sr-only">Buscar producto</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-light-200/60" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className={`${inputCls} pl-10`} />
        </label>
      )}
      <div role="radiogroup" aria-label={picker?.title} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {picker?.allowAuto && (
          <button type="button" role="radio" aria-checked={!picker.selected} onClick={() => pick('')} className={tile(!picker.selected)}>
            <span className="flex aspect-square flex-col items-center justify-center gap-2 bg-main-800 px-3 text-center text-xs font-semibold text-light-200/80">
              <Wand2 size={20} aria-hidden="true" /> La elegimos del menú
            </span>
            <span className="px-2.5 py-2 text-sm font-bold text-light-100">Automática</span>
          </button>
        )}
        {shown.map((p) => {
          const active = picker.selected === p.docId
          return (
            <button key={p.docId} type="button" role="radio" aria-checked={active} onClick={() => pick(p.docId)} className={tile(active)}>
              <img src={productImage(p, 'c_fill,g_auto,w_300,h_300,f_auto,q_auto')} alt="" loading="lazy" className="aspect-square w-full bg-main-800 object-cover" />
              <span className="truncate px-2.5 py-2 text-sm font-bold text-light-100">{p.name}</span>
              {active && (
                <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-snow" aria-hidden="true">
                  <Check size={15} strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>
      {shown.length === 0 && (
        <p className="py-10 text-center text-sm text-light-200/70">
          {options.length ? 'Ningún producto se llama así.' : 'No hay productos con foto para elegir. Sube fotos en Menú.'}
        </p>
      )}
    </Drawer>
  )
}

const SectionPicker = ({ picker, onClose }) => (
  <Drawer isOpen={Boolean(picker)} onClose={onClose} title="Agregar sección del menú" subtitle="Sale como una tarjeta con foto y precio “desde”.">
    <ul className="grid gap-2">
      {(picker?.options || []).map((sec) => (
        <li key={sec.docId}>
          <button
            type="button"
            onClick={() => { picker.onPick(sec.docId); onClose() }}
            className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-main-900 px-4 text-left transition-colors hover:border-primary/40 cursor-pointer"
          >
            <span className="font-bold text-light-100">{sec.name}</span>
            <span className="text-sm capitalize text-light-200/70">{sec.category}</span>
          </button>
        </li>
      ))}
    </ul>
  </Drawer>
)

// ── Page ─────────────────────────────────────────────────────────────────────
export const LandingEditor = () => {
  const { content: live, loading } = useLandingContent()
  const [draft, setDraft] = useState(null)
  const [recovered, setRecovered] = useState(false)
  const [picker, setPicker] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [notice, setNotice] = useState(null) // { tone, text }

  // Start from this device's unpublished draft, if there is one.
  useEffect(() => {
    if (loading || draft) return
    const local = readLocalDraft()
    if (local && !sameContent(local, live)) { setDraft(local); setRecovered(true) } else setDraft(live)
  }, [loading, draft, live])

  const dirty = Boolean(draft) && !sameContent(draft, live)

  // Keep the draft on this device (survives a reload or leaving the page).
  useEffect(() => {
    if (!draft) return undefined
    const t = setTimeout(() => writeLocalDraft(dirty ? draft : null), 300)
    return () => clearTimeout(t)
  }, [draft, dirty])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    if (notice?.tone !== 'success') return undefined
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const editor = useMemo(() => ({
    set: (path, value) => setDraft((d) => setPath(d, path, value)),
    upload: async (file) => {
      try {
        const { url } = await uploadToCloudinary(file, 'landing')
        return url
      } catch {
        setNotice({ tone: 'error', text: 'No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.' })
        return null
      }
    },
    pickProduct: (opts) => setPicker({ kind: 'product', ...opts }),
    pickSection: (opts) => setPicker({ kind: 'section', ...opts }),
  }), [])

  const publish = async () => {
    const problem = validate(draft)
    if (problem) { setNotice({ tone: 'error', text: problem }); return }
    setPublishing(true)
    setNotice(null)
    try {
      await setDoc(landingDocRef(), { ...publishable(draft), updatedAt: serverTimestamp() }, { merge: true })
      writeLocalDraft(null)
      setRecovered(false)
      setNotice({ tone: 'success', text: 'Listo, la página ya muestra tus cambios.' })
    } catch {
      setNotice({ tone: 'error', text: 'No se pudo publicar. Revisa tu conexión e intenta de nuevo.' })
    } finally {
      setPublishing(false)
    }
  }

  const discard = () => {
    setDraft(live)
    setRecovered(false)
    writeLocalDraft(null)
    setNotice(null)
  }

  if (!draft) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-main-900" />
        <div className="h-[70vh] animate-pulse rounded-[28px] bg-main-900" />
      </div>
    )
  }

  // The preview shows the live "Cerrado hoy" on top of the draft.
  const previewContent = { ...draft, closure: live.closure }

  return (
    <div className="space-y-4">
      <ClosureCard live={live} hours={draft.hours} />

      {/* Publish bar: sticks flush to the top while scrolling (the negative top cancels the page padding, which sticky respects) */}
      <div className="sticky -top-4 z-30 -mx-4 border-b border-white/10 bg-main-950/95 px-4 py-3 backdrop-blur-md md:-top-6 md:mx-0 md:rounded-2xl md:border md:bg-main-900/95">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 basis-full text-sm sm:basis-0 sm:flex-1" aria-live="polite">
            {dirty ? (
              <><span className="font-bold text-light-100">Cambios sin publicar.</span> <span className="hidden text-light-200/75 sm:inline">Tus clientes aún ven la versión anterior.</span></>
            ) : (
              <><span className="font-bold text-light-100">Todo publicado.</span> <span className="text-light-200/75">Toca cualquier texto para cambiarlo.</span></>
            )}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <a href="/home" target="_blank" rel="noopener noreferrer" className={btnSecondary} aria-label="Ver la página publicada en otra pestaña">
              <ExternalLink size={16} aria-hidden="true" /> <span className="hidden sm:inline">Ver página</span>
            </a>
            {dirty && (
              <button type="button" onClick={discard} className={btnSecondary}>
                <Undo2 size={16} aria-hidden="true" /> Descartar
              </button>
            )}
            <button type="button" onClick={publish} disabled={!dirty || publishing} className={btnPrimary}>
              <UploadCloud size={16} aria-hidden="true" /> {publishing ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </div>
        {recovered && dirty && (
          <p className="mt-2 text-xs text-light-200/75">Recuperamos los cambios que dejaste sin publicar en este dispositivo.</p>
        )}
        {notice && <div className="mt-3"><Notice tone={notice.tone} icon={notice.tone === 'error' ? AlertCircle : Check}>{notice.text}</Notice></div>}
      </div>

      {/* The page itself, in the customer colors, with inputs in place of text */}
      <div className="landing-scope -mx-4 overflow-hidden border-y border-white/10 md:mx-0 md:rounded-[28px] md:border md:shadow-[0_30px_60px_-40px_var(--color-ink)]">
        <div className="flex items-center gap-3 bg-main-800 px-4 py-2.5" aria-hidden="true">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-full bg-main-900 px-3 py-1 text-center text-xs font-semibold text-light-200/70">
            {window.location.host}/home
          </span>
        </div>
        <LandingPage content={previewContent} editor={editor} />
      </div>

      <ProductPicker key={picker?.title} picker={picker?.kind === 'product' ? picker : null} onClose={() => setPicker(null)} />
      <SectionPicker picker={picker?.kind === 'section' ? picker : null} onClose={() => setPicker(null)} />
    </div>
  )
}
