/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { LogOut, Bell, BellOff, BellRing, Settings, Package, PackageX, ChefHat, RefreshCw, Sun, Moon, Download } from 'lucide-react'
import { ROLE_ICONS } from '../../utils/stations'
import { formatMoney } from '../../utils/cart'
import { timeAgo, webOrderPreview } from '../../utils/webOrders'
import { formatQuantity, getUnitShortLabel } from '../../utils/recipeCalculations'
import { useAdminAlerts } from '../../context/AdminAlertsContext'
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

  // Notification bell: pending web orders + stock running out (AdminAlertsContext)
  const {
    pendingOrders, importOrder, lowStock, permission, askPermission, canTakeOrders,
  } = useAdminAlerts()
  const alertCount = pendingOrders.length + lowStock.length
  const [bellOpen, setBellOpen]   = useState(false)
  const bellRef = useRef(null)
  const canOpenStock = !(selectedStation?.disabledRoutes || []).includes('stock')

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 60000)
    return () => clearInterval(timer)
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
              aria-label={alertCount > 0 ? `Avisos: ${alertCount}` : 'Avisos'}
            >
              {pendingOrders.length > 0 ? <BellRing size={19} className="alert-shake text-primary dark:text-main-300" /> : <Bell size={19} />}
              {alertCount > 0 && (
                <span className={`absolute top-0.5 right-0.5 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full text-[10px] font-bold text-snow border-2 border-main-900 ${pendingOrders.length > 0 ? 'bg-rose-600' : 'bg-amber-500'}`}>
                  {alertCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="fixed md:absolute inset-x-3 md:inset-x-auto top-[68px] md:top-auto md:right-0 md:mt-2 md:w-96 max-h-[75dvh] flex flex-col bg-main-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                  {/* Web orders */}
                  {canTakeOrders && (
                    <section>
                      <p className="px-4 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-light-200/60">Pedidos del menú</p>
                      {pendingOrders.length === 0 ? (
                        <p className="px-4 pb-3 text-sm text-light-200/60">Ninguno esperando. Cuando un cliente pida por WhatsApp aparecerá aquí.</p>
                      ) : (
                        <ul className="divide-y divide-white/10">
                          {pendingOrders.map(order => (
                            <li key={order.id} className="px-4 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="flex items-center gap-2 text-sm font-bold text-light-100">
                                  #{order.orderId}
                                  <span className="font-semibold text-light-200/60 text-xs">{timeAgo(order.createdAt)}</span>
                                </p>
                                <p className="text-xs text-light-200/70 truncate">{webOrderPreview(order)}</p>
                                <p className="text-xs font-bold text-light-100 tabular-nums mt-0.5">{formatMoney(Number(order.total || 0))}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setBellOpen(false); importOrder(order.id) }}
                                className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-primary text-snow text-xs font-bold hover:bg-secondary cursor-pointer"
                              >
                                <Download size={14} /> Importar
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}

                  {/* Stock */}
                  <section className="border-t border-white/10">
                    <p className="px-4 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-light-200/60">Inventario por agotarse</p>
                    {lowStock.length === 0 ? (
                      <p className="px-4 pb-3 text-sm text-light-200/60 flex items-center gap-2"><Package size={15} /> Todo con buen nivel.</p>
                    ) : (
                      <ul className="pb-2">
                        {lowStock.slice(0, 8).map(m => (
                          <li key={m.id} className="px-4 py-1.5 flex items-center gap-2.5 text-sm">
                            <PackageX size={15} className={Number(m.currentStock) <= 0 ? 'text-rose-400' : 'text-amber-400'} />
                            <span className="flex-1 truncate text-light-100">{m.name}</span>
                            <span className={`tabular-nums text-xs font-bold ${Number(m.currentStock) <= 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                              {Number(m.currentStock) <= 0 ? 'Agotado' : `${formatQuantity(Number(m.currentStock) || 0)} ${getUnitShortLabel(m.unit)}`}
                            </span>
                          </li>
                        ))}
                        {lowStock.length > 8 && <li className="px-4 py-1 text-xs text-light-200/60">y {lowStock.length - 8} más</li>}
                      </ul>
                    )}
                    {lowStock.length > 0 && canOpenStock && (
                      <div className="px-4 pb-3">
                        <button
                          onClick={() => { setBellOpen(false); navigate('/admin/stock') }}
                          className="w-full min-h-[40px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-400 cursor-pointer"
                        >
                          Ver inventario
                        </button>
                      </div>
                    )}
                  </section>
                </div>

                {/* System notifications status */}
                {canTakeOrders && permission !== 'unsupported' && (
                  <div className="px-4 py-3 border-t border-white/10 bg-main-800/60 flex items-center gap-2.5 text-xs">
                    {permission === 'granted' ? (
                      <><BellRing size={15} className="text-emerald-400" /><span className="text-light-200/75">Avisos con sonido y notificación activados en este dispositivo.</span></>
                    ) : permission === 'denied' ? (
                      <><BellOff size={15} className="text-rose-400" /><span className="text-light-200/75">Las notificaciones están bloqueadas. Actívalas desde el candado de la barra de direcciones.</span></>
                    ) : (
                      <>
                        <BellOff size={15} className="text-light-200/60" />
                        <span className="flex-1 text-light-200/75">Recibe avisos aunque estés en otra pestaña.</span>
                        <button onClick={askPermission} className="shrink-0 min-h-[36px] px-3 rounded-lg bg-primary text-snow font-bold cursor-pointer hover:bg-secondary">Activar</button>
                      </>
                    )}
                  </div>
                )}
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
