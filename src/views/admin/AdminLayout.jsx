import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { useAdminTheme } from '../../hooks/useAdminTheme'
import { Sidebar } from '../../components/admin/Sidebar'
import { Topbar } from '../../components/admin/Topbar'
import { BottomTabBar } from '../../components/admin/BottomTabBar'
import { StationGate } from '../../components/admin/StationGate'
import { AdminAlerts, PendingOrdersBar } from '../../components/admin/AdminAlerts'
import { AdminAlertsProvider } from '../../context/AdminAlertsContext'
import { PageGuide } from '../../components/admin/PageGuide'
import { PAGE_GUIDES, navItemForPath } from '../../config/adminNav'
import { useStationContext } from '../../context/StationContext'
import { KitchenBoard } from './KitchenBoard'
import Logo from '../../assets/bklogo.svg'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { FlaskConical } from 'lucide-react'
import { auth, isTestEnv } from '../../firebase'

export const AdminLayout = () => {
  const {
    isAuthReady, isAuthenticated, user, handleLogout,
    email, setEmail, password, setPassword,
    error, isSubmitting, handleLogin, handleGoogleSignIn,
  } = useAdminAuth()

  const { selectedStation, role, loading: stationLoading } = useStationContext()
  const location = useLocation()
  const currentNav = navItemForPath(location.pathname)

  // Admin light/dark theme (classes on <html>, see index.css)
  const { theme, toggleTheme } = useAdminTheme()

  // Collapse state lives here so AdminLayout can mirror the sidebar width
  // as a margin-left offset on the content wrapper — keeping both in sync.
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true'
  })

  if (!isAuthReady) {
    return (
      <div className="min-h-dvh bg-main-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-primary px-5 py-4 animate-pulse"><img src={Logo} alt="Bubble Kaapeh" className="h-9" /></div>
          <p className="text-sm font-semibold text-light-200/70">Cargando…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh bg-main-950 text-light-100 font-body flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-[28px] bg-main-900 shadow-[0_30px_60px_-30px_var(--color-ink)] overflow-hidden">
            <div className="bg-primary px-8 pt-8 pb-7 text-center">
              <img src={Logo} alt="Bubble Kaapeh" className="mx-auto h-12" />
              <p className="mt-3 text-sm font-semibold text-snow/80">Panel de administración</p>
            </div>

            <form className="p-6 sm:p-8 space-y-4" onSubmit={handleLogin}>
              <div>
                <h2 className="font-display text-2xl font-semibold">Inicia sesión</h2>
                <p className="mt-1 text-sm text-light-200/70">Usa la cuenta autorizada del negocio.</p>
              </div>

              {/* Test mode only: the login exists solely in the local Auth emulator */}
              {isTestEnv && import.meta.env.VITE_TEST_LOGIN_EMAIL && (
                <button
                  type="button"
                  onClick={() => signInWithEmailAndPassword(auth, import.meta.env.VITE_TEST_LOGIN_EMAIL, import.meta.env.VITE_TEST_LOGIN_PASSWORD).catch(() => {})}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-amber-950 transition hover:brightness-105 cursor-pointer"
                >
                  <FlaskConical size={16} /> Entrar como usuario de prueba
                </button>
              )}

              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="text-sm font-semibold">Correo</label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-white/15 bg-main-800 px-4 text-light-100 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="text-sm font-semibold">Contraseña</label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-white/15 bg-main-800 px-4 text-light-100 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  required
                />
              </div>

              {error && (
                <div role="alert" className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] rounded-xl bg-primary px-4 text-sm font-bold text-snow transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? 'Entrando…' : 'Entrar'}
              </button>

              <div className="flex items-center gap-3 text-xs text-light-200/60">
                <span className="h-px flex-1 bg-white/10" />
                o
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full min-h-[48px] rounded-xl border border-white/15 bg-main-900 px-4 text-sm font-bold text-light-100 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? 'Conectando…' : 'Entrar con Google'}
              </button>
            </form>
          </div>

          <div className="mt-6 text-center">
            <NavLink to="/" className="text-sm font-semibold text-light-200/70 hover:text-primary dark:hover:text-main-300 transition">
              ← Volver al menú
            </NavLink>
          </div>
        </div>
      </div>
    )
  }

  if (stationLoading) {
    return (
      <div className="min-h-dvh bg-main-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-primary px-5 py-4 animate-pulse"><img src={Logo} alt="Bubble Kaapeh" className="h-9" /></div>
          <p className="text-sm font-semibold text-light-200/70">Cargando…</p>
        </div>
      </div>
    )
  }

  if (!selectedStation) {
    return <StationGate />
  }

  if (role === 'kitchen') {
    return <KitchenBoard />
  }

  return (
    /*
     * h-dvh overflow-hidden — locks the shell to exactly the visible viewport
     * (100dvh tracks mobile browsers' collapsing address bar; 100vh does not).
     * Nothing outside this box can scroll; only the inner <main> can.
     */
    <AdminAlertsProvider>
      <div className="h-dvh overflow-hidden bg-main-950 text-light-100 font-body flex">

        {/* Fixed sidebar — never participates in page scroll */}
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={() => setIsCollapsed((v) => !v)}
        />

        {/*
         * Content wrapper — offset by sidebar width via margin-left.
         * Transitions in sync with the sidebar's own width transition
         * so there's no gap or overlap during collapse/expand.
         */}
        <div
          className={`
            flex flex-col flex-1 min-w-0 overflow-hidden
            transition-all duration-300
            ${isCollapsed ? 'md:ml-20' : 'md:ml-60'}
          `}
        >
          <PendingOrdersBar />

          {/* Topbar is sticky within this column, not the whole page */}
          <Topbar
            user={user}
            handleLogout={handleLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
          />

          {/*
           * Only this <main> scrolls.
           * overflow-y-auto + flex-1 fills remaining height after the topbar.
           */}
          <main className="flex-1 overflow-y-auto bg-main-950 px-4 pt-4 pb-28 md:px-8 md:pt-6 md:pb-10">
            <div className="mx-auto w-full max-w-[1400px]">
              {currentNav && PAGE_GUIDES[currentNav.routeKey] && (
                <PageGuide routeKey={currentNav.routeKey} title={currentNav.name} steps={PAGE_GUIDES[currentNav.routeKey]} />
              )}
              <Outlet />
            </div>
          </main>
        </div>

        {/* Bottom tab bar — mobile only */}
        <BottomTabBar />

        {/* New web order popup, stock toast, notification permission prompt */}
        <AdminAlerts />
      </div>
    </AdminAlertsProvider>
  )
}
