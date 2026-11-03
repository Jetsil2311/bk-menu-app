/* eslint-disable react/prop-types */
import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Camera, Plus, RotateCcw, X } from 'lucide-react'
import { DEFAULT_LANDING, getPath } from '../../config/landingContent'

// The landing page renders the same in two modes:
//   editor = null → the real page (text, links)
//   editor = { set, upload, … } → Admin → Landing: every text becomes an
//   inline text box in place, links stop navigating, and photo / list
//   controls appear. Only the content changes, never the layout.
export const LandingCtx = createContext({ content: DEFAULT_LANDING, editor: null })
export const useLanding = () => useContext(LandingCtx)

// Single-line text typed straight into the page (same font and size).
const InlineInput = ({ value, onChange, label, placeholder, className }) => {
  const ref = useRef(null)
  // Uncontrolled while typing so the caret never jumps; synced otherwise
  // (Descartar, a recovered draft…).
  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value
  }, [value])
  return (
    <span
      ref={ref}
      role="textbox"
      tabIndex={0}
      aria-label={label}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={`lp-edit ${className}`}
      onInput={(e) => onChange(e.currentTarget.textContent.replace(/\s*\n\s*/g, ' '))}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      onPaste={(e) => {
        // Older browsers without plaintext-only would paste formatting.
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '))
      }}
    />
  )
}

// Text from content[k]. `req` = a button label or similar that can't be
// blank on the live page (falls back to the default).
export const T = ({ k, label, req = false, className = '' }) => {
  const { content, editor } = useLanding()
  const value = getPath(content, k) ?? ''
  const fallback = getPath(DEFAULT_LANDING, k) ?? ''
  if (!editor) return (req && !String(value).trim() ? fallback : value) || null
  return <InlineInput value={value} onChange={(v) => editor.set(k, v)} label={label} placeholder={fallback || '+'} className={className} />
}

// Heading { pre, mark, post } with the highlighted words in the middle.
export const HighlightTitle = ({ k, label, Highlight, markClass }) => {
  const { content, editor } = useLanding()
  const t = getPath(content, k) || {}
  if (!editor) {
    return (
      <>
        {t.pre && <>{t.pre} </>}
        {t.mark && <Highlight className={markClass}>{t.mark}</Highlight>}
        {t.post && <> {t.post}</>}
      </>
    )
  }
  return (
    <>
      <T k={`${k}.pre`} label={`${label}: inicio`} />{' '}
      <Highlight className={markClass}><T k={`${k}.mark`} label={`${label}: palabras resaltadas`} /></Highlight>{' '}
      <T k={`${k}.post`} label={`${label}: final`} />
    </>
  )
}

// A link on the live page; a plain box in the editor (so clicking edits).
export const Go = ({ to, href, external = false, onClick, className, children, ...rest }) => {
  const { editor } = useLanding()
  if (editor) return <span className={className}>{children}</span>
  if (to) return <Link to={to} onClick={onClick} className={className} {...rest}>{children}</Link>
  return (
    <a href={href} onClick={onClick} className={className} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
      {children}
    </a>
  )
}

export const EditOnly = ({ children }) => (useLanding().editor ? children : null)

// ── Editor controls (customer palette, so they sit naturally on the page) ──

// `label` = accessible name when the button shows only its icon.
export const EditButton = ({ icon: Icon, children, onClick, className = '', disabled, label }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`lp-control inline-flex min-h-[44px] items-center gap-2 rounded-full bg-surface px-4 text-sm font-bold text-ink shadow-[0_10px_24px_-12px_var(--color-espresso)] ring-1 ring-ink/10 transition hover:bg-accent active:scale-[0.97] disabled:opacity-60 cursor-pointer ${className}`}
  >
    {Icon && <Icon size={16} aria-hidden="true" />}
    {children}
  </button>
)

export const RemoveButton = ({ label, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`lp-control inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-[0_10px_24px_-12px_var(--color-espresso)] ring-1 ring-ink/10 transition hover:bg-fresa hover:text-fresa-ink active:scale-95 cursor-pointer ${className}`}
  >
    <X size={18} aria-hidden="true" />
  </button>
)

export const AddTile = ({ children, onClick, className = 'min-h-[44px]' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`lp-control flex w-full items-center justify-center gap-2 rounded-[1.75rem] border-2 border-dashed border-primary/30 p-4 font-bold text-primary transition-colors hover:border-primary hover:bg-surface cursor-pointer ${className}`}
  >
    <Plus size={18} aria-hidden="true" /> {children}
  </button>
)

// "Cambiar foto" on a photo: uploads a new one into content[k].
// An empty value means the page's automatic photo.
export const PhotoControl = ({ k, className = 'absolute right-3 top-3 z-10' }) => {
  const { content, editor } = useLanding()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  if (!editor) return null
  const value = getPath(content, k)
  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    // editor.upload shows its own error and returns null when it fails
    const url = await editor.upload(file)
    setBusy(false)
    if (url) editor.set(k, url)
  }
  return (
    <div className={`flex gap-2 ${className}`}>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={onFile} />
      <EditButton icon={Camera} onClick={() => input.current?.click()} disabled={busy}>
        {busy ? 'Subiendo…' : 'Cambiar foto'}
      </EditButton>
      {value && !busy && (
        <EditButton icon={RotateCcw} onClick={() => editor.set(k, '')}>Original</EditButton>
      )}
    </div>
  )
}
