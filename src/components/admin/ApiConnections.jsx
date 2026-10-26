/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { Check, Copy, Link2, Plus, Trash2 } from 'lucide-react'
import { auth, db } from '../../firebase'
import { API_KEYS_COLLECTION, SCOPES, generateApiKey, hashApiKey, keyPreview } from '../../utils/apiKeys'

const inputCls =
  'w-full rounded-xl border border-white/10 bg-main-800/60 px-4 py-3 text-sm text-light-200 placeholder-light-200/50 outline-none focus:border-main-500/40 transition min-h-[48px]'

const fmtDate = (ts) => {
  const d = ts?.toDate?.()
  return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : null
}

const CopyButton = ({ text, label }) => {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* no clipboard */ }
      }}
      aria-label={label}
      className="shrink-0 h-11 px-3 inline-flex items-center gap-1.5 rounded-xl bg-primary text-snow text-xs font-bold hover:bg-secondary cursor-pointer"
    >
      {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

// Ajustes → Conexiones: POS API keys that let another app (Tally) read the
// café's finances through /api/v1 — see src/utils/apiKeys.js and
// docs/POS_API.md. The plain key is shown once; only its hash is saved.
export const ApiConnections = ({ SectionHead }) => {
  const [keys, setKeys] = useState([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null) // { name, key }
  const [confirmRevoke, setConfirmRevoke] = useState(null)
  const endpoint = `${window.location.origin}/api/v1`

  useEffect(() => onSnapshot(
    collection(db, API_KEYS_COLLECTION),
    (snap) => setKeys(snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((k) => !k.revokedAt)
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))),
    () => setError('No se pudieron cargar las conexiones.'),
  ), [])

  const create = async () => {
    const label = name.trim()
    if (!label) { setError('Ponle un nombre, por ejemplo "Tally".'); return }
    setBusy(true); setError('')
    try {
      const key = generateApiKey()
      await setDoc(doc(db, API_KEYS_COLLECTION, await hashApiKey(key)), {
        name: label,
        prefix: keyPreview(key),
        scopes: [SCOPES.financeRead],
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || null,
        lastUsedAt: null,
        revokedAt: null,
      })
      setCreated({ name: label, key })
      setName('')
    } catch {
      setError('No se pudo crear la clave. Revisa la conexión.')
    } finally { setBusy(false) }
  }

  const revoke = async (id) => {
    try {
      await updateDoc(doc(db, API_KEYS_COLLECTION, id), { revokedAt: serverTimestamp() })
      setConfirmRevoke(null)
    } catch { setError('No se pudo desconectar.') }
  }

  return (
    <section>
      <SectionHead
        icon={Link2}
        label="Conexiones (API)"
        hint="Conecta otra app, como Tally, para que lea tus ventas, costos, gastos e inventario. Solo puede leer; nunca cambia nada del café."
      />

      {created && (
        <div className="mb-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
          <p className="text-sm font-bold text-light-100">Copia la clave de “{created.name}” ahora. No se volverá a mostrar.</p>
          <div className="flex gap-2">
            <code className="flex-1 min-w-0 h-11 px-3 flex items-center overflow-x-auto rounded-xl bg-main-900 font-mono text-xs text-light-100 whitespace-nowrap">{created.key}</code>
            <CopyButton text={created.key} label="Copiar clave" />
          </div>
          <div>
            <p className="text-xs text-light-200/75 mb-1">Dirección de la API</p>
            <div className="flex gap-2">
              <code className="flex-1 min-w-0 h-11 px-3 flex items-center overflow-x-auto rounded-xl bg-main-900 font-mono text-xs text-light-100 whitespace-nowrap">{endpoint}</code>
              <CopyButton text={endpoint} label="Copiar dirección" />
            </div>
          </div>
          <button type="button" onClick={() => setCreated(null)} className="text-xs font-bold text-emerald-400 cursor-pointer">Ya la copié</button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="Nombre de la app (ej. Tally)"
          className={inputCls}
        />
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="shrink-0 min-h-[48px] px-4 inline-flex items-center gap-1.5 rounded-xl bg-primary text-snow text-sm font-bold hover:bg-secondary disabled:opacity-50 cursor-pointer"
        >
          <Plus size={16} /> {busy ? 'Creando…' : 'Crear clave'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-rose-400">{error}</p>}

      {keys.length > 0 && (
        <ul className="mt-3 space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-light-100 truncate">{k.name}</p>
                <p className="text-xs text-light-200/65 truncate">
                  <span className="font-mono">{k.prefix}</span>
                  {fmtDate(k.createdAt) && <> · creada {fmtDate(k.createdAt)}</>}
                  {' · '}{k.lastUsedAt ? `último uso ${fmtDate(k.lastUsedAt)}` : 'sin usar'}
                </p>
              </div>
              {confirmRevoke === k.id ? (
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={() => setConfirmRevoke(null)} className="min-h-[40px] px-3 rounded-xl border border-white/15 text-xs font-bold text-light-100 cursor-pointer">No</button>
                  <button type="button" onClick={() => revoke(k.id)} className="min-h-[40px] px-3 rounded-xl bg-red-600 text-xs font-bold text-snow cursor-pointer">Desconectar</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(k.id)}
                  aria-label={`Desconectar ${k.name}`}
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl text-light-200/70 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
