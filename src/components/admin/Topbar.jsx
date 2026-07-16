/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { LogOut, User, Bell, Settings, Package, Lock, LockOpen } from 'lucide-react'
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore'
import { db } from '../../firebase'
import { formatMoney } from '../../utils/cart'
import { useRegister } from '../../hooks/useRegister'
import { useSettings } from '../../hooks/useSettings'
import { ADMIN_PIN } from '../../config/adminPin'
import { PhoneChip, EmailsChip, PinChip, PrinterChip } from './SettingsChips'
import { MobileSettingsSheet } from './MobileSettingsSheet'
import { PinPrompt } from './PinGate'

const ROUTE_KEYS = {
  '/admin':             'overview',
  '/admin/pedidos':     'pedidos',
  '/admin/metricas':    'metricas',
  '/admin/promociones': 'promociones',
  '/admin/menu':        'menu',
  '/admin/pos':         'pos',
  '/admin/clientes':    'clientes',
  '/admin/caja':        'caja',
  '/admin/legacy':      'legacy',
}

export const Topbar = ({ user, handleLogout, pinGateConfig = {}, toggleRouteKey }) => {
  const location = useLocation()
  const navigate  = useNavigate()
  const [dateTime, setDateTime] = useState(new Date())
  const { isRegisterOpen, loading } = useRegister()
  const { settings } = useSettings()
  const isOverview = location.pathname === '/admin'

  const currentRouteKey = ROUTE_KEYS[location.pathname] ?? null
  const isCurrentScreenLocked = currentRouteKey
    ? pinGateConfig[currentRouteKey] === true
    : null

  const handleToggleLock = () => {
    if (!currentRouteKey || !toggleRouteKey) return
    toggleRouteKey(currentRouteKey)
  }

  // PIN prompt for lock toggle confirmation
  const [pinPromptOpen, setPinPromptOpen] = useState(false)

  // Mobile settings sheet
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false)

  // User avatar dropdown (click-based for mobile + hover for desktop)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef(null)

  // Notification bell dropdown
  const [newOrders, setNewOrders] = useState([])
  const [bellOpen, setBellOpen]   = useState(false)
  const bellRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Real-time listener: fetch recent orders, filter to 'Nuevo' client-side
  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (cancelled) return
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(20))
      unsub = onSnapshot(q, snap => {
        if (!alive) return
        const nuevo = snap.docs
          .map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate() ?? new Date(),
          }))
          .filter(o => (o.status || '').toLowerCase() === 'nuevo')
          .slice(0, 3)
        setNewOrders(nuevo)
      })
    }, 0)
    return () => {
      cancelled = true
      alive = false
      clearTimeout(timer)
      if (unsub) try { unsub() } catch {}
    }
  }, [])

  // Close avatar dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setAvatarOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close bell dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close all dropdowns when navigating
  useEffect(() => { setMobileSettingsOpen(false); setBellOpen(false) }, [location.pathname])

  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/admin')             return 'Overview'
    if (path === '/admin/pedidos')     return 'Pedidos'
    if (path === '/admin/metricas')    return 'Métricas'
    if (path === '/admin/promociones') return 'Promociones'
    if (path === '/admin/menu')        return 'Editor de Menú'
    if (path === '/admin/pos')         return 'POS — Punto de Venta'
    if (path === '/admin/caja')        return 'Caja'
    if (path === '/admin/clientes')    return 'Clientes'
    if (path === '/admin/legacy')      return 'Menu Editor (Legacy)'
    return 'Admin'
  }

  const formattedDate = dateTime.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <>
      <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-main-950 border-b border-white/5 sticky top-0 z-40 shrink-0">

        {/* ── Left: title + Caja badge (desktop) + date (desktop) ── */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile: app name on overview, page title on other pages */}
            <h1 className="md:hidden text-base font-bold text-light-100 truncate">
              {isOverview ? 'Bubble Kaapeh' : getPageTitle()}
            </h1>
            {/* Desktop: page title */}
            <h1 className="hidden md:block text-lg font-semibold text-light-100">{getPageTitle()}</h1>

            {/* Caja badge — desktop only (mobile gets the banner below) */}
            {!loading && (
              <div className={`hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all ${
                isRegisterOpen
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isRegisterOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {isRegisterOpen ? 'Caja Abierta' : 'Caja Cerrada'}
              </div>
            )}
          </div>
          {/* Date — desktop only */}
          <p className="hidden md:block text-xs text-light-200/40 capitalize mt-0.5">{formattedDate}</p>
        </div>

        {/* ── Right: controls ── */}
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">

          {/* Settings chips — desktop / Overview only */}
          {isOverview && (
            <div className="hidden md:flex items-center gap-1.5">
              <PhoneChip phone={settings?.orderNotificationPhone} />
              <EmailsChip emails={settings?.authorizedEmails} />
              <PinChip currentPin={settings?.adminPin || ADMIN_PIN} />
              <PrinterChip settings={settings} />
            </div>
          )}

          {/* Settings icon — mobile / Overview only */}
          {isOverview && (
            <button
              type="button"
              onClick={() => setMobileSettingsOpen(true)}
              aria-label="Configuración"
              className="md:hidden h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/5 text-light-200/60 hover:text-light-200 transition-colors cursor-pointer"
            >
              <Settings size={20} />
            </button>
          )}

          {/* Screen lock toggle — always visible when on a known route */}
          {isCurrentScreenLocked !== null && (
            <button
              onClick={() => setPinPromptOpen(true)}
              title={isCurrentScreenLocked ? 'Pantalla protegida con PIN — clic para desbloquear' : 'Pantalla libre — clic para bloquear con PIN'}
              aria-label={isCurrentScreenLocked ? 'Quitar protección PIN de esta pantalla' : 'Proteger esta pantalla con PIN'}
              className={`h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors cursor-pointer ${
                isCurrentScreenLocked
                  ? 'text-amber-400 hover:text-amber-300'
                  : 'text-light-200/30 hover:text-light-200/60'
              }`}
            >
              {isCurrentScreenLocked ? <Lock size={16} /> : <LockOpen size={16} />}
            </button>
          )}

          {/* Bell — always visible */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setBellOpen(v => !v)}
              className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/5 text-light-200/60 hover:text-light-200 transition-colors relative cursor-pointer"
              aria-label="Notificaciones"
            >
              <Bell size={19} />
              {newOrders.length > 0 && (
                <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white border-2 border-main-950 animate-pulse">
                  {newOrders.length}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 mt-2 w-72 md:w-80 bg-main-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">

                {/* Dropdown header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <p className="text-sm font-semibold text-light-100">Nuevos pedidos</p>
                  {newOrders.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                      {newOrders.length} nuevo{newOrders.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Order list */}
                {newOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-light-200/25">
                    <Package size={28} />
                    <p className="text-xs">Sin pedidos nuevos</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {newOrders.map(order => {
                      const shortId = order.orderId
                        ? order.orderId.slice(-6)
                        : order.id.slice(-4).toUpperCase()
                      const diffMin = Math.floor((Date.now() - order.createdAt.getTime()) / 60000)
                      const timeAgo = diffMin < 1
                        ? 'Ahora'
                        : diffMin < 60
                        ? `hace ${diffMin} min`
                        : `hace ${Math.floor(diffMin / 60)} h`
                      const preview = Array.isArray(order.items) && order.items.length > 0
                        ? order.items.map(it => `${it.qty > 1 ? `${it.qty}× ` : ''}${it.name}`).slice(0, 2).join(' · ')
                        : (order.content || '').split('\n').filter(l => /^\d+\./.test(l.trim())).map(l => l.replace(/^\d+\.\s*/, '')).slice(0, 2).join(' · ') || '—'

                      return (
                        <div key={order.id} className="px-4 py-3 hover:bg-white/3 transition-colors">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                                #{shortId}
                              </span>
                              {order.customerName && (
                                <span className="text-xs text-light-200/50 truncate">
                                  {order.customerName}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-light-100 tabular-nums shrink-0">
                              {formatMoney(Number(order.total || 0))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-light-200/35 truncate">{preview}</p>
                            <span className="text-[10px] text-light-200/25 shrink-0 tabular-nums">{timeAgo}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Footer CTA */}
                <div className="px-4 py-3 border-t border-white/5">
                  <button
                    onClick={() => { setBellOpen(false); navigate('/admin/pedidos') }}
                    className="w-full rounded-xl bg-main-500/15 hover:bg-main-500/25 border border-main-500/20 py-2 text-xs font-semibold text-main-300 hover:text-main-200 transition-colors cursor-pointer"
                  >
                    Ver todos los pedidos
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider — desktop only */}
          <div className="hidden md:block h-8 w-px bg-white/5" />

          {/* User name + avatar */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-light-100">{user?.displayName || 'Admin'}</p>
              <p className="text-[10px] text-light-200/40 truncate max-w-[120px]">{user?.email}</p>
            </div>

            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => setAvatarOpen(v => !v)}
                aria-label="Menú de usuario"
                className="h-9 w-9 rounded-xl bg-main-800 border border-white/10 flex items-center justify-center overflow-hidden hover:border-white/20 transition-all cursor-pointer"
              >
                {user?.photoURL
                  ? <img src={user.photoURL} alt="Avatar" className="h-full w-full object-cover" />
                  : <User size={19} className="text-light-200/60" />
                }
              </button>

              {/* Dropdown */}
              {avatarOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-main-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-white/5 mb-1">
                    <p className="text-sm font-semibold text-light-100 truncate">{user?.displayName || 'Admin'}</p>
                    <p className="text-xs text-light-200/40 truncate mt-0.5">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setAvatarOpen(false); handleLogout() }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <LogOut size={16} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile Caja status banner — full-width, below header ── */}
      {!loading && (
        <div className={`md:hidden flex items-center justify-center gap-2 py-2 text-[11px] font-bold uppercase tracking-wider shrink-0 transition-all ${
          isRegisterOpen
            ? 'bg-emerald-500/8 border-b border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/6 border-b border-rose-500/15 text-rose-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isRegisterOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          {isRegisterOpen ? 'Caja Abierta' : 'Caja Cerrada'}
        </div>
      )}

      {/* Mobile settings sheet */}
      {mobileSettingsOpen && (
        <MobileSettingsSheet
          settings={settings}
          onClose={() => setMobileSettingsOpen(false)}
        />
      )}

      {/* PIN confirmation before toggling screen lock */}
      {pinPromptOpen && (
        <PinPrompt
          onSuccess={() => { setPinPromptOpen(false); handleToggleLock() }}
          onCancel={() => setPinPromptOpen(false)}
          prompt={isCurrentScreenLocked
            ? `Quitar protección PIN de ${getPageTitle()}`
            : `Proteger ${getPageTitle()} con PIN`
          }
        />
      )}
    </>
  )
}
