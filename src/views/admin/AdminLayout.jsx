import { useEffect, useState } from 'react'
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
import { FlaskConical, ShieldCheck } from 'lucide-react'
import { auth, isTestEnv } from '../../firebase'

// Official multicolor Google "G" mark (colors are tokens in index.css)
const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 transition-transform duration-200 group-hover:scale-110">
    <path fill="var(--color-google-red)" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="var(--color-google-blue)" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="var(--color-google-yellow)" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="var(--color-google-green)" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

export const AdminLayout = () => {
  const {
    isAuthReady, isAuthenticated, user, handleLogout,
    error, isSubmitting, handleGoogleSignIn,
  } = useAdminAuth()

  const { selectedStation, role, loading: stationLoading } = useStationContext()
  const location = useLocation()
  const currentNav = navItemForPath(location.pathname)
  const guideSteps = currentNav ? PAGE_GUIDES[currentNav.routeKey] : null

  // Page help is opened on demand from the "?" in the Topbar; it closes
  // again whenever the page changes.
  const [guideOpen, setGuideOpen] = useState(false)
  useEffect(() => { setGuideOpen(false) }, [location.pathname])

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
      <div className="login-bg min-h-dvh text-light-100 font-body flex items-center justify-center p-4">
        <div className="login-card-in w-full max-w-sm">
          <div className="rounded-[32px] bg-main-900 shadow-[0_40px_80px_-40px_var(--color-ink)] overflow-hidden">
            {/* Brand header with rising boba bubbles */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary to-secondary px-8 pt-10 pb-12 text-center">
              <span className="bubble" style={{ left: '12%', width: 18, height: 18, animationDelay: '0s' }} />
              <span className="bubble" style={{ left: '30%', width: 10, height: 10, animationDelay: '2.4s' }} />
              <span className="bubble" style={{ left: '68%', width: 22, height: 22, animationDelay: '1.2s' }} />
              <span className="bubble" style={{ left: '86%', width: 12, height: 12, animationDelay: '3.6s' }} />
              <img src={Logo} alt="Bubble Kaapeh" className="relative mx-auto h-14" />
              <p className="relative mt-3 text-xs font-bold uppercase tracking-[0.3em] text-snow/75">Panel de administración</p>
              {/* Wavy bottom edge */}
              <svg aria-hidden="true" viewBox="0 0 400 24" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px h-6 w-full fill-main-900">
                <path d="M0 24V12c40-10 80-10 120 0s80 10 120 0 80-10 120 0c16 4 28 6 40 6v6z" />
              </svg>
            </div>

            <div className="px-6 pb-8 pt-4 sm:px-8 text-center">
              <h2 className="font-display text-3xl font-semibold">¡Hola de nuevo!</h2>
              <p className="mt-2 text-sm text-light-200/70">Entra con la cuenta de Google del negocio para abrir el panel.</p>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="group mt-7 w-full min-h-[56px] inline-flex items-center justify-center gap-3 rounded-full bg-snow px-6 text-base font-bold text-ink shadow-[0_10px_24px_-12px_var(--color-ink)] ring-1 ring-ink/10 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-14px_var(--color-ink)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary/40 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0 cursor-pointer"
              >
                {isSubmitting ? (
                  <span aria-hidden="true" className="h-5 w-5 rounded-full border-2 border-ink/20 border-t-primary animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                {isSubmitting ? 'Conectando…' : 'Continuar con Google'}
              </button>

              {error && (
                <div role="alert" className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400">
                  {error}
                </div>
              )}

              {/* Test mode only: the login exists solely in the local Auth emulator */}
              {isTestEnv && import.meta.env.VITE_TEST_LOGIN_EMAIL && (
                <button
                  type="button"
                  onClick={() => signInWithEmailAndPassword(auth, import.meta.env.VITE_TEST_LOGIN_EMAIL, import.meta.env.VITE_TEST_LOGIN_PASSWORD).catch(() => {})}
                  className="mt-3 w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-4 text-sm font-bold text-amber-950 transition hover:brightness-105 cursor-pointer"
                >
                  <FlaskConical size={16} /> Entrar como usuario de prueba
                </button>
              )}

              <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-light-200/55">
                <ShieldCheck size={14} aria-hidden="true" /> Solo cuentas autorizadas
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <NavLink to="/" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-light-200/70 hover:text-primary dark:hover:text-main-300 transition">
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
            hasGuide={Boolean(guideSteps?.length)}
            guideOpen={guideOpen}
            onToggleGuide={() => setGuideOpen((v) => !v)}
          />

          {/*
           * Only this <main> scrolls.
           * overflow-y-auto + flex-1 fills remaining height after the topbar.
           */}
          <main className="flex-1 overflow-y-auto bg-main-950 px-4 pt-4 pb-28 md:px-8 md:pt-6 md:pb-10">
            <div className="mx-auto w-full max-w-[1400px]">
              {guideOpen && guideSteps && (
                <PageGuide title={currentNav.name} steps={guideSteps} onClose={() => setGuideOpen(false)} />
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
