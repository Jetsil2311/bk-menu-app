/* eslint-disable react/prop-types */
import { useState, useCallback, useEffect } from 'react'
import { doc, setDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { ADMIN_PIN } from '../../config/adminPin'
import { Phone, Shield, Lock, X, Plus, Check } from 'lucide-react'

const SETTINGS_REF = () => doc(db, 'settings', 'general')

const inputCls = [
  'w-full rounded-xl border border-white/10 bg-main-800/60',
  'px-4 py-3 text-sm text-light-200 placeholder-light-200/25',
  'outline-none focus:border-main-500/40 transition',
  'min-h-[48px]',
].join(' ')

// ── Section heading ────────────────────────────────────────────────────────────

const SectionHead = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon size={14} className="text-light-200/40 shrink-0" />
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-light-200/40">{label}</p>
  </div>
)

// ── MobileSettingsSheet ────────────────────────────────────────────────────────

export const MobileSettingsSheet = ({ settings, onClose }) => {
  const emails    = Array.isArray(settings?.authorizedEmails) ? settings.authorizedEmails : []
  const activePin = settings?.adminPin || ADMIN_PIN

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Phone section ────────────────────────────────────────────────────────────
  const [phoneVal, setPhoneVal]     = useState(settings?.orderNotificationPhone || '')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneSaved, setPhoneSaved]   = useState(false)

  const savePhone = useCallback(async () => {
    const v = phoneVal.trim()
    if (!v) return
    setPhoneSaving(true)
    try {
      await setDoc(SETTINGS_REF(), { orderNotificationPhone: v, updatedAt: serverTimestamp() }, { merge: true })
      setPhoneSaved(true)
      setTimeout(() => setPhoneSaved(false), 2000)
    } finally { setPhoneSaving(false) }
  }, [phoneVal])

  // ── Emails section ───────────────────────────────────────────────────────────
  const [newEmail, setNewEmail]   = useState('')
  const [emailErr, setEmailErr]   = useState('')
  const [emailSaving, setEmailSaving] = useState(false)

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailErr('Correo no válido'); return }
    if (emails.includes(email)) { setEmailErr('Ya existe'); return }
    setEmailSaving(true)
    try {
      await setDoc(SETTINGS_REF(), { authorizedEmails: arrayUnion(email), updatedAt: serverTimestamp() }, { merge: true })
      setNewEmail(''); setEmailErr('')
    } catch { setEmailErr('Error al guardar') }
    finally { setEmailSaving(false) }
  }

  const removeEmail = async (email) => {
    try {
      await setDoc(SETTINGS_REF(), { authorizedEmails: arrayRemove(email), updatedAt: serverTimestamp() }, { merge: true })
    } catch {}
  }

  // ── PIN section ──────────────────────────────────────────────────────────────
  const onlyDigits = (v) => v.replace(/\D/g, '').slice(0, 4)

  const [pinActual,  setPinActual]  = useState('')
  const [pinNuevo,   setPinNuevo]   = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinErrs,    setPinErrs]    = useState({})
  const [pinSaving,  setPinSaving]  = useState(false)
  const [pinSaved,   setPinSaved]   = useState(false)

  const savePin = async () => {
    const errs = {}
    if (pinActual !== activePin)  errs.actual  = 'PIN actual incorrecto'
    if (pinNuevo.length !== 4)    errs.nuevo   = 'Debe tener 4 dígitos'
    if (pinNuevo !== pinConfirm)  errs.confirm = 'Los PINs no coinciden'
    if (Object.keys(errs).length) { setPinErrs(errs); return }
    setPinSaving(true)
    try {
      await setDoc(SETTINGS_REF(), { adminPin: pinNuevo, updatedAt: serverTimestamp() }, { merge: true })
      setPinSaved(true)
      setPinActual(''); setPinNuevo(''); setPinConfirm(''); setPinErrs({})
      setTimeout(() => setPinSaved(false), 2000)
    } catch { setPinErrs({ general: 'Error al guardar' }) }
    finally { setPinSaving(false) }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9000] flex flex-col justify-end" style={{ touchAction: 'none' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-main-900 rounded-t-[20px] border-t border-white/8 flex flex-col max-h-[88vh]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 shrink-0">
          <div className="w-10 h-[4px] rounded-full bg-light-200/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5 shrink-0">
          <h2 className="text-base font-semibold text-light-100">Configuración</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-white/8 text-light-200/50 cursor-pointer transition-colors"
            aria-label="Cerrar configuración"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="overflow-y-auto flex-1 px-5 py-5 space-y-7"
          style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))' }}
        >

          {/* ── Phone ─────────────────────────────────────────────────────── */}
          <section>
            <SectionHead icon={Phone} label="Teléfono de notificaciones" />
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneVal}
                onChange={e => setPhoneVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') savePhone() }}
                placeholder="+52 55 0000 0000"
                className={inputCls}
              />
              <button
                type="button"
                onClick={savePhone}
                disabled={phoneSaving || !phoneVal.trim()}
                className="px-4 rounded-xl bg-main-500/20 border border-main-500/30 text-main-400 text-sm font-semibold hover:bg-main-500/30 transition cursor-pointer disabled:opacity-40 min-h-[48px] shrink-0"
              >
                {phoneSaved
                  ? <Check size={16} className="text-emerald-400" />
                  : phoneSaving ? '…' : 'OK'}
              </button>
            </div>
          </section>

          {/* ── Emails ────────────────────────────────────────────────────── */}
          <section>
            <SectionHead icon={Shield} label="Correos autorizados" />
            {emails.length === 0 ? (
              <p className="text-xs text-light-200/30 italic px-1 mb-3">Sin correos autorizados</p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {emails.map(email => (
                  <div key={email} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-main-800/60 border border-white/5">
                    <span className="flex-1 text-sm text-light-200/70 truncate">{email}</span>
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      aria-label={`Eliminar ${email}`}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-rose-500/15 text-light-200/30 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setEmailErr('') }}
                onKeyDown={e => { if (e.key === 'Enter') addEmail() }}
                placeholder="nuevo@correo.com"
                className={inputCls}
              />
              <button
                type="button"
                onClick={addEmail}
                disabled={emailSaving}
                aria-label="Agregar correo"
                className="h-12 w-12 flex items-center justify-center rounded-xl bg-main-500/20 border border-main-500/30 text-main-400 hover:bg-main-500/30 transition cursor-pointer disabled:opacity-40 shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>
            {emailErr && <p className="text-xs text-rose-400 mt-1.5">{emailErr}</p>}
          </section>

          {/* ── PIN ───────────────────────────────────────────────────────── */}
          <section>
            <SectionHead icon={Lock} label="Cambiar PIN de acceso" />
            {pinSaved ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                <Check size={16} />
                PIN actualizado correctamente
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinActual}
                  onChange={e => { setPinActual(onlyDigits(e.target.value)); setPinErrs(p => ({ ...p, actual: undefined })) }}
                  placeholder="PIN actual"
                  className={inputCls + ' tracking-[0.35em]'}
                />
                {pinErrs.actual && <p className="text-xs text-rose-400">{pinErrs.actual}</p>}

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinNuevo}
                  onChange={e => { setPinNuevo(onlyDigits(e.target.value)); setPinErrs(p => ({ ...p, nuevo: undefined, confirm: undefined })) }}
                  placeholder="Nuevo PIN"
                  className={inputCls + ' tracking-[0.35em]'}
                />
                {pinErrs.nuevo && <p className="text-xs text-rose-400">{pinErrs.nuevo}</p>}

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinConfirm}
                  onChange={e => { setPinConfirm(onlyDigits(e.target.value)); setPinErrs(p => ({ ...p, confirm: undefined })) }}
                  placeholder="Confirmar nuevo PIN"
                  className={inputCls + ' tracking-[0.35em]'}
                />
                {pinErrs.confirm && <p className="text-xs text-rose-400">{pinErrs.confirm}</p>}
                {pinErrs.general && <p className="text-xs text-rose-400">{pinErrs.general}</p>}

                <button
                  type="button"
                  onClick={savePin}
                  disabled={pinSaving || !pinActual || !pinNuevo || !pinConfirm}
                  className="w-full py-3 rounded-xl bg-main-500 hover:bg-main-400 text-sm font-bold text-white transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
                >
                  {pinSaving ? 'Guardando…' : 'Actualizar PIN'}
                </button>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
