/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { LogOut, Bell, Settings, Package, ChefHat, RefreshCw, Sun, Moon } from 'lucide-react'
import { ROLE_ICONS } from '../../utils/stations'
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore'
import { db } from '../../firebase'
import { formatMoney } from '../../utils/cart'
import { useRegister } from '../../hooks/useRegister'
import { useSettings } from '../../hooks/useSettings'
import { useStationContext } from '../../context/StationContext'
import { navItemForPath } from '../../config/adminNav'
import { MobileSettingsSheet } from './MobileSettingsSheet'

export const Topbar = ({ user, handleLogout, theme = 'light', onToggleTheme }) => {
  const location = useLocation()
  const navigate  = useNavigate()
  const [dateTime, setDateTime] = useState(new Date())
  const { isRegisterOpen, loading } = useRegister()
  const { settings } = useSettings()
  const { selectedStation, clearStation, role } = useStationContext()
  const canEditSettings = role === 'admin'
  const [avatarFailed, setAvatarFailed] = useState(false)

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

  const currentNav = navItemForPath(location.pathname)
  const pageTitle = location.pathname.startsWith('/admin/legacy')
    ? 'Editor de menú (anterior)'
    : currentNav?.name ?? 'Panel'
  const pageDesc = currentNav?.desc ?? ''

  const formattedDate = dateTime.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <>
      <header className="h-16 md:h-[72px] flex items-center justify-between gap-3 px-4 md:px-8 bg-main-950/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-40 shrink-0">

        {/* ── Left: page title + what this screen is for ── */}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-xl md:text-2xl font-semibold text-light-100 truncate leading-tight">{pageTitle}</h1>
            {!loading && (
              <span
                className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  isRegisterOpen ? 'bg-emerald-500/12 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isRegisterOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {isRegisterOpen ? 'Caja abierta' : 'Caja cerrada'}
              </span>
            )}
          </div>
          <p className="hidden md:block text-xs text-light-200/70 truncate mt-0.5">
            <span className="capitalize">{formattedDate}</span>
            {pageDesc && <span> · {pageDesc}</span>}
          </p>
        </div>

        {/* ── Right: controls ── */}
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">

          {/* Light / dark theme switch (saved on this device) */}
          {onToggleTheme && (
            <button
              type="button"
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
              onClick={onToggleTheme}
              className="relative h-10 w-10 flex items-center justify-center rounded-xl text-light-200/80 hover:bg-white/5 hover:text-light-100 transition-colors cursor-pointer"
            >
              <Sun size={19} className="absolute transition-all duration-300 rotate-0 scale-100 opacity-100 dark:-rotate-90 dark:scale-0 dark:opacity-0" />
              <Moon size={18} className="absolute transition-all duration-300 rotate-90 scale-0 opacity-0 dark:rotate-0 dark:scale-100 dark:opacity-100" />
            </button>
          )}

          {/* Ajustes — owner settings (WhatsApp, accesos, impresora) */}
          {canEditSettings && (
            <button
              type="button"
              onClick={() => setMobileSettingsOpen(true)}
              aria-label="Ajustes"
              className="h-10 min-w-10 px-2.5 md:px-3 flex items-center justify-center gap-2 rounded-xl text-light-200/80 hover:bg-white/5 hover:text-light-100 transition-colors cursor-pointer"
            >
              <Settings size={19} />
              <span className="hidden lg:inline text-sm font-semibold">Ajustes</span>
            </button>
          )}

          {/* Station chip — doubles as the "switch station" button, always
              visible (not desktop-only) so every station has direct access
              from the top navbar, not just buried in the avatar menu. */}
          {selectedStation && (() => {
            const StationIcon = ROLE_ICONS[selectedStation.role] || ChefHat
            return (
              <button
                type="button"
                onClick={clearStation}
                title="Cambiar estación"
                className="flex items-center gap-1.5 h-10 px-3 rounded-xl bg-primary/8 hover:bg-primary/15 text-primary dark:text-main-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <StationIcon size={13} />
                <span className="max-w-[70px] sm:max-w-none truncate">{selectedStation.name}</span>
                <RefreshCw size={11} className="opacity-60 shrink-0" />
              </button>
            )
          })()}

          {/* Bell — always visible */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setBellOpen(v => !v)}
              className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white/5 text-light-200/80 hover:text-light-100 transition-colors relative cursor-pointer"
              aria-label="Pedidos nuevos"
            >
              <Bell size={19} />
              {newOrders.length > 0 && (
                <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-snow border-2 border-main-900">
                  {newOrders.length}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 mt-2 w-72 md:w-80 bg-main-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">

                {/* Dropdown header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <p className="text-sm font-semibold text-light-100">Nuevos pedidos</p>
                  {newOrders.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                      {newOrders.length} nuevo{newOrders.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Order list */}
                {newOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-light-200/50">
                    <Package size={28} />
                    <p className="text-xs">Sin pedidos nuevos</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
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
                                <span className="text-xs text-light-200/70 truncate">
                                  {order.customerName}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-light-100 tabular-nums shrink-0">
                              {formatMoney(Number(order.total || 0))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-light-200/60 truncate">{preview}</p>
                            <span className="text-[10px] text-light-200/50 shrink-0 tabular-nums">{timeAgo}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Footer CTA */}
                <div className="px-4 py-3 border-t border-white/10">
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
          <div className="hidden md:block h-8 w-px bg-white/10" />

          {/* User name + avatar */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="text-right hidden xl:block">
              <p className="text-sm font-medium text-light-100">{user?.displayName || 'Admin'}</p>
              <p className="text-[10px] text-light-200/65 truncate max-w-[120px]">{user?.email}</p>
            </div>

            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => setAvatarOpen(v => !v)}
                aria-label="Menú de usuario"
                className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer"
              >
                {user?.photoURL && !avatarFailed
                  ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} className="h-full w-full object-cover" />
                  : <span className="text-sm font-bold text-primary dark:text-main-300">{(user?.displayName || user?.email || 'A').trim().charAt(0).toUpperCase()}</span>
                }
              </button>

              {/* Dropdown */}
              {avatarOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-main-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-white/10 mb-1">
                    <p className="text-sm font-semibold text-light-100 truncate">{user?.displayName || 'Admin'}</p>
                    <p className="text-xs text-light-200/65 truncate mt-0.5">{user?.email}</p>
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
        <div className={`md:hidden flex items-center justify-center gap-2 py-1.5 text-xs font-bold shrink-0 transition-all ${
          isRegisterOpen
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-rose-500/8 text-rose-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isRegisterOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          {isRegisterOpen ? 'Caja abierta' : 'Caja cerrada'}
        </div>
      )}

      {/* Mobile settings sheet */}
      {mobileSettingsOpen && (
        <MobileSettingsSheet
          settings={settings}
          onClose={() => setMobileSettingsOpen(false)}
        />
      )}
    </>
  )
}
