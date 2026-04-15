import { useState } from 'react'
import { Outlet, NavLink } from 'react-router'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { Sidebar } from '../../components/admin/Sidebar'
import { Topbar } from '../../components/admin/Topbar'

export const AdminLayout = () => {
  const {
    isAuthReady, isAuthenticated, user, handleLogout,
    email, setEmail, password, setPassword,
    error, isSubmitting, handleLogin, handleGoogleSignIn,
  } = useAdminAuth()

  // Collapse state lives here so AdminLayout can mirror the sidebar width
  // as a margin-left offset on the content wrapper — keeping both in sync.
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true'
  })

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-main-900 text-light-200 flex items-center justify-center">
        <p className="text-sm uppercase tracking-[0.35em] text-light-200/70 animate-pulse">
          Cargando acceso
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-main-900 text-light-200 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-light-100">Bubble Kaapeh</h1>
            <p className="mt-2 text-sm text-light-200/60">Admin Panel</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-main-800/60 p-8 shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl font-semibold">Inicia sesión</h2>
            <p className="mt-2 text-sm text-light-200/70">
              Acceso restringido solo para administradores.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Correo</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contraseña</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-main-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-main-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="flex items-center gap-3 text-xs text-light-200/30">
                <span className="h-px flex-1 bg-white/10" />
                o
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-light-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Conectando...' : 'Entrar con Google'}
              </button>
            </form>
          </div>

          <div className="text-center">
            <NavLink to="/" className="text-sm text-light-200/40 hover:text-light-200 transition">
              Volver al menú
            </NavLink>
          </div>
        </div>
      </div>
    )
  }

  return (
    /*
     * h-screen overflow-hidden — locks the shell to exactly the viewport.
     * Nothing outside this box can scroll; only the inner <main> can.
     */
    <div className="h-screen overflow-hidden bg-main-950 flex">

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
          ${isCollapsed ? 'ml-20' : 'ml-60'}
        `}
      >
        {/* Topbar is sticky within this column, not the whole page */}
        <Topbar user={user} handleLogout={handleLogout} />

        {/*
         * Only this <main> scrolls.
         * overflow-y-auto + flex-1 fills remaining height after the topbar.
         */}
        <main className="flex-1 overflow-y-auto bg-[#2a1208] rounded-tl-3xl border-t border-l border-white/5 p-6 md:p-8">
          <Outlet />
        </main>
      </div>

    </div>
  )
}
