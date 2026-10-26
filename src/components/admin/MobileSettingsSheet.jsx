/* eslint-disable react/prop-types */
import { useState, useCallback, useEffect } from 'react'
import { doc, setDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router'
import { MessageCircle, Shield, Printer, KeyRound, X, Plus, Check, ChevronRight } from 'lucide-react'
import { PrinterChip } from './SettingsChips'
import { ApiConnections } from './ApiConnections'

const SETTINGS_REF = () => doc(db, 'settings', 'general')

const inputCls = [
  'w-full rounded-xl border border-white/10 bg-main-800/60',
  'px-4 py-3 text-sm text-light-200 placeholder-light-200/50',
  'outline-none focus:border-main-500/40 transition',
  'min-h-[48px]',
].join(' ')

// ── Section heading ────────────────────────────────────────────────────────────

const SectionHead = ({ icon: Icon, label, hint }) => (
  <div className="flex items-start gap-3 mb-3">
    <span className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary dark:text-main-300 flex items-center justify-center">
      <Icon size={18} />
    </span>
    <div className="min-w-0">
      <p className="text-sm font-bold text-light-100">{label}</p>
      {hint && <p className="text-xs text-light-200/70 mt-0.5 leading-snug">{hint}</p>}
    </div>
  </div>
)

// ── Ajustes sheet ──────────────────────────────────────────────────────────────
// Bottom sheet on phones, centered dialog on desktop. Opened from the Topbar
// "Ajustes" button. (Station PINs live in Estaciones — the old global
// "Cambiar PIN" here wrote settings.adminPin, which nothing reads anymore.)

export const MobileSettingsSheet = ({ settings, onClose }) => {
  const navigate = useNavigate()
  const emails    = Array.isArray(settings?.authorizedEmails) ? settings.authorizedEmails : []

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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9000] flex flex-col justify-end md:items-center md:justify-center md:p-6" role="dialog" aria-modal="true" aria-label="Ajustes">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-main-900 rounded-t-[24px] md:rounded-[24px] md:w-full md:max-w-lg shadow-2xl flex flex-col max-h-[88vh]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 shrink-0 md:hidden">
          <div className="w-10 h-[4px] rounded-full bg-light-200/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
          <div>
            <h2 className="font-display text-xl font-semibold text-light-100">Ajustes</h2>
            <p className="text-xs text-light-200/70">Configuración general del negocio</p>
          </div>
          <button
            onClick={onClose}
            className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-white/5 text-light-200/70 cursor-pointer transition-colors"
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
            <SectionHead icon={MessageCircle} label="WhatsApp para pedidos" hint="Los pedidos del menú digital se envían a este número. Escríbelo con lada de país (ej. 52 para México)." />
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneVal}
                onChange={e => setPhoneVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') savePhone() }}
                placeholder="Ej. 52 55 1234 5678"
                className={inputCls}
              />
              <button
                type="button"
                onClick={savePhone}
                disabled={phoneSaving || !phoneVal.trim()}
                className="px-4 rounded-xl bg-primary text-snow text-sm font-bold hover:bg-secondary transition cursor-pointer disabled:opacity-40 min-h-[48px] shrink-0"
              >
                {phoneSaved
                  ? <Check size={16} className="text-emerald-400" />
                  : phoneSaving ? '…' : 'Guardar'}
              </button>
            </div>
          </section>

          {/* ── Emails ────────────────────────────────────────────────────── */}
          <section>
            <SectionHead icon={Shield} label="Correos con acceso al panel" hint="Solo estas cuentas pueden iniciar sesión en el panel." />
            {emails.length === 0 ? (
              <p className="text-xs text-light-200/55 italic px-1 mb-3">Sin correos autorizados</p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {emails.map(email => (
                  <div key={email} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-main-800/60 border border-white/10">
                    <span className="flex-1 text-sm text-light-200/70 truncate">{email}</span>
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      aria-label={`Eliminar ${email}`}
                      className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-rose-500/15 text-light-200/55 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
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

          {/* ── Printer ───────────────────────────────────────────────────── */}
          <section>
            <SectionHead icon={Printer} label="Impresora de tickets" hint="Imprime el ticket al cobrar y permite reimprimir desde Pedidos." />
            <div className="rounded-2xl border border-white/10 p-4">
              <PrinterChip settings={settings} inline />
            </div>
          </section>

          {/* ── Conexiones: POS API keys for Tally etc. ───────────────────── */}
          <ApiConnections SectionHead={SectionHead} />

          {/* ── PINs live in Estaciones ───────────────────────────────────── */}
          <button
            type="button"
            onClick={() => { onClose(); navigate('/admin/estaciones') }}
            className="w-full flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-left hover:bg-white/5 transition-colors cursor-pointer"
          >
            <span className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary dark:text-main-300 flex items-center justify-center">
              <KeyRound size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-light-100">PINs y permisos</span>
              <span className="block text-xs text-light-200/70">Cada estación tiene su propio PIN. Cámbialos en Estaciones.</span>
            </span>
            <ChevronRight size={18} className="text-light-200/55 shrink-0" />
          </button>

        </div>
      </div>
    </div>
  )
}
