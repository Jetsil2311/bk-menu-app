/* eslint-disable react/prop-types */
import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, setDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { ADMIN_PIN } from '../../config/adminPin'
import { Phone, Shield, Lock, Check, X, Plus, Printer, Cable } from 'lucide-react'
import {
  connectUsbPrinter,
  getOrConnectUsbPrinter,
  getConnectedDeviceName,
  isWebUsbSupported,
} from '../../utils/printing/usbPrinter'
import { printViaWindows } from '../../utils/printing/windowsPrinter'

const SETTINGS_REF = () => doc(db, 'settings', 'general')

// Shared pill base — matches CAJA ABIERTA badge height and weight
const CHIP = [
  'relative flex items-center gap-1.5 px-2.5 h-[26px]',
  'rounded-full border border-white/10 bg-white/[0.04]',
  'text-[10px] font-medium text-light-200/60',
  'hover:border-white/20 hover:text-light-200',
  'cursor-pointer transition-all duration-200 select-none shrink-0',
].join(' ')

const CHIP_ACTIVE = 'border-main-500/30 bg-main-500/10 text-light-200'

// ── Popover container ─────────────────────────────────────────────────────────
const Popover = ({ children }) => (
  <div className="absolute right-0 top-full mt-2 bg-main-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
    {children}
  </div>
)

// ── PhoneChip ─────────────────────────────────────────────────────────────────
export const PhoneChip = ({ phone }) => {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(phone || '')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!editing) setValue(phone || '')
  }, [phone, editing])

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 30)
  }, [editing])

  const save = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await setDoc(SETTINGS_REF(), { orderNotificationPhone: trimmed, updatedAt: serverTimestamp() }, { merge: true })
      setSaved(true)
      setTimeout(() => { setSaved(false); setEditing(false) }, 800)
    } catch { /* keep editing */ }
    finally { setSaving(false) }
  }, [value])

  const cancel = useCallback(() => { setValue(phone || ''); setEditing(false) }, [phone])

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 h-[26px] rounded-full border border-main-500/30 bg-main-500/10 text-[10px] shrink-0">
        <Phone size={11} className="text-main-400 shrink-0" />
        <input
          ref={inputRef}
          type="tel"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          placeholder="+52 55 0000 0000"
          className="w-32 bg-transparent text-light-200 outline-none placeholder-light-200/25 text-[10px]"
        />
        <button
          type="button" onClick={save}
          disabled={saving || !value.trim()}
          aria-label="Guardar número"
          className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
        >
          <Check size={10} className={saved ? 'text-emerald-400' : 'text-light-200/60'} />
        </button>
        <button
          type="button" onClick={cancel}
          aria-label="Cancelar"
          className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={10} className="text-light-200/40" />
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => setEditing(true)} aria-label="Editar número de notificación" className={CHIP}>
      <Phone size={11} className="shrink-0" />
      <span className="hidden sm:inline max-w-[110px] truncate">
        {phone
          ? <span>{phone}</span>
          : <span className="text-light-200/30">Agregar número</span>
        }
      </span>
    </button>
  )
}

// ── EmailsChip ────────────────────────────────────────────────────────────────
export const EmailsChip = ({ emails }) => {
  const list = Array.isArray(emails) ? emails : []
  const [open, setOpen]           = useState(false)
  const [newEmail, setNewEmail]   = useState('')
  const [emailError, setEmailError] = useState('')
  const [saving, setSaving]       = useState(false)
  const containerRef = useRef(null)
  const inputRef     = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!containerRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Correo no válido'); return }
    if (list.includes(email)) { setEmailError('Ya existe'); return }
    setSaving(true)
    try {
      await setDoc(SETTINGS_REF(), { authorizedEmails: arrayUnion(email), updatedAt: serverTimestamp() }, { merge: true })
      setNewEmail(''); setEmailError('')
    } catch { setEmailError('Error al guardar') }
    finally { setSaving(false) }
  }

  const removeEmail = async (email) => {
    try {
      await setDoc(SETTINGS_REF(), { authorizedEmails: arrayRemove(email), updatedAt: serverTimestamp() }, { merge: true })
    } catch {}
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Gestionar accesos por correo"
        className={`${CHIP} ${open ? CHIP_ACTIVE : ''}`}
      >
        <Shield size={11} className="shrink-0" />
        <span className="hidden sm:inline">
          {list.length > 0
            ? `${list.length} acceso${list.length !== 1 ? 's' : ''}`
            : <span className="text-light-200/30">Sin accesos</span>
          }
        </span>
      </button>

      {open && (
        <Popover>
          <div className="w-72">
            {/* Email list — max 4 rows before scroll */}
            <div className="max-h-[152px] overflow-y-auto divide-y divide-white/5">
              {list.length === 0 ? (
                <p className="px-4 py-3 text-[11px] text-light-200/30 italic">Sin correos autorizados</p>
              ) : list.map(email => (
                <div key={email} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="text-[11px] text-light-200/70 truncate flex-1">{email}</span>
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    aria-label={`Eliminar ${email}`}
                    className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-rose-500/15 text-light-200/30 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add input */}
            <div className="border-t border-white/5 px-3 py-2.5 space-y-1">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="email"
                  value={newEmail}
                  onChange={e => { setNewEmail(e.target.value); setEmailError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') addEmail() }}
                  placeholder="nuevo@correo.com"
                  className="flex-1 min-w-0 bg-main-800/60 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-light-200 placeholder-light-200/25 outline-none focus:border-main-500/40 transition"
                />
                <button
                  type="button"
                  onClick={addEmail}
                  disabled={saving}
                  aria-label="Agregar correo"
                  className="h-7 w-7 flex items-center justify-center rounded-xl bg-main-500/20 border border-main-500/30 text-main-400 hover:bg-main-500/30 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                >
                  <Plus size={13} />
                </button>
              </div>
              {emailError && <p className="text-[10px] text-rose-400 pl-1">{emailError}</p>}
            </div>
          </div>
        </Popover>
      )}
    </div>
  )
}

// ── PrinterChip ───────────────────────────────────────────────────────────────
export const PrinterChip = ({ settings }) => {
  const [open, setOpen]               = useState(false)
  const [method, setMethod]           = useState('windows')        // 'usb' | 'windows'
  const [printingEnabled, setEnabled] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [footerMsg, setFooterMsg]     = useState('')
  const [autoPrint, setAutoPrint]     = useState(true)
  // USB-specific state
  const [usbStatus, setUsbStatus]     = useState('idle')           // 'idle' | 'connecting' | 'connected' | 'error'
  const [usbDevice, setUsbDevice]     = useState(null)             // device name string
  // Windows-specific state
  const [testing, setTesting]         = useState(false)
  const [testResult, setTestResult]   = useState(null)             // 'ok' | 'fail' | null
  // Save state
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const containerRef = useRef(null)

  // Sync from Firestore settings
  useEffect(() => {
    if (!settings) return
    setMethod(settings.printMethod || 'windows')
    setEnabled(settings.printingEnabled || false)
    setBusinessName(settings.receiptBusinessName || '')
    setFooterMsg(settings.receiptFooterMessage   || '')
    setAutoPrint(settings.autoPrintOnPayment !== false)
  }, [settings])

  // Auto-reconnect to a previously-paired USB device when popover opens
  useEffect(() => {
    if (!open || method !== 'usb' || usbStatus === 'connected') return
    setUsbStatus('connecting')
    getOrConnectUsbPrinter()
      .then(device => {
        if (device) { setUsbStatus('connected'); setUsbDevice(getConnectedDeviceName()) }
        else          setUsbStatus('idle')
      })
      .catch(() => setUsbStatus('idle'))
  }, [open, method])

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleMethodChange = (m) => {
    setMethod(m)
    setTestResult(null)
    if (m === 'usb' && usbStatus !== 'connected') {
      setUsbStatus('idle')
    }
  }

  const handleConnectUsb = async () => {
    if (!isWebUsbSupported()) { setUsbStatus('error'); return }
    setUsbStatus('connecting')
    const result = await connectUsbPrinter()
    if (result.success) {
      setUsbStatus('connected')
      setUsbDevice(result.deviceName)
    } else if (result.error !== 'cancelled') {
      setUsbStatus('error')
    } else {
      setUsbStatus('idle')
    }
  }

  const handleWindowsTest = async () => {
    setTesting(true)
    setTestResult(null)
    const dummyContent = {
      businessName:  businessName || 'Bubble Kaapeh',
      orderId:       'TEST',
      timestamp:     new Date(),
      items:         [{ name: 'Café Americano', quantity: 1, unitPrice: 40, options: null, toppings: [], note: null, totalPrice: 40 }],
      subtotal: 40, subtotalSinIva: 34.48, iva: 5.52, discount: 0, total: 40,
      paymentMethod: 'cash', cashReceived: 50, change: 10,
      customerName: null, loyaltyInfo: null, orderNote: null,
      footerMessage: footerMsg || '¡Gracias por tu visita!',
    }
    try {
      await printViaWindows(dummyContent)
      setTestResult('ok')
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await setDoc(SETTINGS_REF(), {
        printMethod:          method,
        printingEnabled:      printingEnabled,
        receiptBusinessName:  businessName.trim() || null,
        receiptFooterMessage: footerMsg.trim()    || null,
        autoPrintOnPayment:   autoPrint,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setSaved(true)
      setTimeout(() => { setSaved(false); setOpen(false) }, 1000)
    } catch { /* keep open */ }
    finally { setSaving(false) }
  }

  // Chip label
  const chipLabel = printingEnabled
    ? method === 'usb' ? 'USB' : 'Windows'
    : 'Impresora'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Configurar impresora térmica"
        className={`${CHIP} ${open ? CHIP_ACTIVE : ''}`}
      >
        <Printer size={11} className={`shrink-0 ${printingEnabled ? 'text-emerald-400' : ''}`} />
        <span className="hidden sm:inline max-w-[80px] truncate">{chipLabel}</span>
      </button>

      {open && (
        <Popover>
          <div className="w-80 p-4 space-y-4">
            <p className="text-[11px] font-semibold text-light-200/50 uppercase tracking-wider">Impresora térmica</p>

            {/* Master enable toggle */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-light-200/70 font-medium">Activar impresión</p>
              <button
                type="button"
                onClick={() => setEnabled(v => !v)}
                aria-label={printingEnabled ? 'Desactivar impresión' : 'Activar impresión'}
                className={`relative flex-none w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${printingEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${printingEnabled ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>

            {printingEnabled && <>
              {/* Method selector */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-light-200/40 uppercase tracking-wide">Método de impresión</p>
                <div className="flex gap-2">
                  {[['usb', 'USB Directo'], ['windows', 'Impresora Windows']].map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMethodChange(m)}
                      className={`flex-1 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                        method === m
                          ? 'border-main-500/40 bg-main-500/15 text-main-400'
                          : 'border-white/10 text-light-200/30 hover:border-white/20 hover:text-light-200/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* USB-specific section */}
              {method === 'usb' && (
                <div className="space-y-2">
                  {usbStatus === 'connected' ? (
                    <div className="flex items-center gap-2 py-1.5 px-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-[11px] text-emerald-400 font-medium truncate flex-1">
                        {usbDevice || 'USB Printer'}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setUsbStatus('idle'); setUsbDevice(null) }}
                        className="text-emerald-400/40 hover:text-emerald-400 cursor-pointer transition-colors shrink-0"
                        aria-label="Desconectar"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectUsb}
                      disabled={usbStatus === 'connecting'}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-main-500/20 border border-main-500/30 text-[11px] font-semibold text-main-400 hover:bg-main-500/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Cable size={11} />
                      {usbStatus === 'connecting' ? 'Conectando…' : 'Conectar impresora USB'}
                    </button>
                  )}
                  {usbStatus === 'error' && (
                    <p className="text-[10px] text-rose-400">
                      {isWebUsbSupported()
                        ? 'No se pudo conectar — verifica que la impresora esté encendida'
                        : 'WebUSB requiere Chrome o Edge. Cambia de navegador o usa el método de impresión por Windows.'}
                    </p>
                  )}
                  <p className="text-[10px] text-light-200/25 leading-relaxed">
                    Requiere Chrome o Edge. Si la impresora no aparece, usa Zadig para reemplazar el driver de Windows con WinUSB.
                  </p>
                </div>
              )}

              {/* Windows-specific section */}
              {method === 'windows' && (
                <div className="space-y-2">
                  <p className="text-[10px] text-light-200/30 leading-relaxed">
                    Usará la impresora predeterminada de Windows. Se abrirá el diálogo de impresión.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleWindowsTest}
                      disabled={testing}
                      className="flex-1 py-1.5 rounded-xl border border-white/10 text-[11px] text-light-200/40 hover:border-main-500/30 hover:text-light-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {testing ? 'Imprimiendo…' : 'Probar impresión'}
                    </button>
                    {testResult === 'ok'   && <span className="text-[11px] text-emerald-400 shrink-0">Enviado ✓</span>}
                    {testResult === 'fail' && <span className="text-[11px] text-rose-400 shrink-0">Error</span>}
                  </div>
                </div>
              )}

              <div className="border-t border-white/5" />
            </>}

            {/* Shared fields — always shown */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-light-200/40 uppercase tracking-wide">
                  Nombre del negocio en el ticket
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="Bubble Kaapeh"
                  className="w-full bg-main-800/60 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-light-200 placeholder-light-200/20 outline-none focus:border-main-500/40 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-light-200/40 uppercase tracking-wide">
                  Mensaje de pie de ticket
                </label>
                <input
                  type="text"
                  value={footerMsg}
                  onChange={e => setFooterMsg(e.target.value)}
                  placeholder="¡Gracias por tu visita!"
                  className="w-full bg-main-800/60 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-light-200 placeholder-light-200/20 outline-none focus:border-main-500/40 transition"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-light-200/60 leading-snug">Auto-imprimir al cobrar</p>
                <button
                  type="button"
                  onClick={() => setAutoPrint(v => !v)}
                  aria-label={autoPrint ? 'Desactivar auto-impresión' : 'Activar auto-impresión'}
                  className={`relative flex-none w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${autoPrint ? 'bg-main-500' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${autoPrint ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 rounded-xl bg-main-500 text-white text-xs font-semibold hover:bg-main-400 transition-colors cursor-pointer disabled:opacity-40"
            >
              {saved ? '¡Guardado!' : saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Popover>
      )}
    </div>
  )
}

// ── PinChip ───────────────────────────────────────────────────────────────────
export const PinChip = ({ currentPin }) => {
  const activePin = currentPin || ADMIN_PIN

  const [open, setOpen]             = useState(false)
  const [pinActual, setPinActual]   = useState('')
  const [pinNuevo, setPinNuevo]     = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [errors, setErrors]         = useState({})
  const [saving, setSaving]         = useState(false)
  const [success, setSuccess]       = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (!containerRef.current?.contains(e.target)) { setOpen(false); resetForm() }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const resetForm = () => { setPinActual(''); setPinNuevo(''); setPinConfirm(''); setErrors({}) }

  const onlyDigits = val => val.replace(/\D/g, '').slice(0, 4)

  const handleSave = async () => {
    const errs = {}
    if (pinActual !== activePin)           errs.actual    = 'PIN actual incorrecto'
    if (pinNuevo.length !== 4)             errs.nuevo     = 'El PIN debe tener 4 dígitos'
    if (pinNuevo !== pinConfirm)           errs.confirmar = 'Los PINs no coinciden'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      await setDoc(SETTINGS_REF(), { adminPin: pinNuevo, updatedAt: serverTimestamp() }, { merge: true })
      setSuccess(true)
      setTimeout(() => { setSuccess(false); setOpen(false); resetForm() }, 1200)
    } catch { setErrors({ general: 'Error al guardar' }) }
    finally { setSaving(false) }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { if (open) { setOpen(false); resetForm() } else setOpen(true) }}
        aria-label="Cambiar PIN"
        className={`${CHIP} ${success ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : open ? CHIP_ACTIVE : ''}`}
      >
        <Lock size={11} className="shrink-0" />
        <span className="hidden sm:inline">{success ? 'PIN actualizado' : 'PIN'}</span>
      </button>

      {open && !success && (
        <Popover>
          <div className="w-56 p-4 space-y-3">
            <p className="text-[11px] font-semibold text-light-200/50 uppercase tracking-wider">Cambiar PIN</p>

            {/* PIN actual */}
            <div className="space-y-1">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinActual}
                onChange={e => { setPinActual(onlyDigits(e.target.value)); setErrors(p => ({ ...p, actual: undefined })) }}
                placeholder="PIN actual"
                className="w-full bg-main-800/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-light-200 placeholder-light-200/20 outline-none focus:border-main-500/40 transition tracking-[0.3em]"
              />
              {errors.actual && <p className="text-[10px] text-rose-400">{errors.actual}</p>}
            </div>

            {/* Nuevo PIN */}
            <div className="space-y-1">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinNuevo}
                onChange={e => { setPinNuevo(onlyDigits(e.target.value)); setErrors(p => ({ ...p, nuevo: undefined, confirmar: undefined })) }}
                placeholder="Nuevo PIN"
                className="w-full bg-main-800/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-light-200 placeholder-light-200/20 outline-none focus:border-main-500/40 transition tracking-[0.3em]"
              />
              {errors.nuevo && <p className="text-[10px] text-rose-400">{errors.nuevo}</p>}
            </div>

            {/* Confirmar PIN */}
            <div className="space-y-1">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinConfirm}
                onChange={e => { setPinConfirm(onlyDigits(e.target.value)); setErrors(p => ({ ...p, confirmar: undefined })) }}
                placeholder="Confirmar PIN"
                className="w-full bg-main-800/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-light-200 placeholder-light-200/20 outline-none focus:border-main-500/40 transition tracking-[0.3em]"
              />
              {errors.confirmar && <p className="text-[10px] text-rose-400">{errors.confirmar}</p>}
            </div>

            {errors.general && <p className="text-[10px] text-rose-400">{errors.general}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !pinActual || !pinNuevo || !pinConfirm}
              className="w-full py-2 rounded-xl bg-main-500 text-white text-xs font-semibold hover:bg-main-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando…' : 'Guardar PIN'}
            </button>
          </div>
        </Popover>
      )}
    </div>
  )
}
