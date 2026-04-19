import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { Sidebar } from '../../components/admin/Sidebar'
import { Topbar } from '../../components/admin/Topbar'
import { LogOut, ShieldOff } from 'lucide-react'

export const AdminLayout = () => {
  const {
    isAuthReady, isAuthenticated, user, handleLogout,
    email, setEmail, password, setPassword,
    error, isSubmitting, handleLogin, handleGoogleSignIn,
  } = useAdminAuth()

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true'
  })

  // Email gate: 'loading' | 'authorized' | 'no-list' | 'denied'
  const [emailCheck, setEmailCheck] = useState('loading')

  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      setEmailCheck('loading')
      return
    }
    const ref = doc(db, 'settings', 'general')
    const unsub = onSnapshot(
      ref,
      snap => {
        const emails = snap.exists() ? (snap.data().authorizedEmails || []) : []
        if (emails.length === 0) {
          setEmailCheck('no-list')
        } else if (emails.includes(user.email)) {
          setEmailCheck('authorized')
        } else {
          setEmailCheck('denied')
        }
      },
      () => setEmailCheck('authorized') // on Firestore error, allow access
    )
    return unsub
  }, [isAuthenticated, user])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!isAuthReady || (isAuthenticated && emailCheck === 'loading')) {
    return (
      <div className="min-h-screen bg-main-900 text-light-200 flex items-center justify-center">
        <p className="text-sm uppercase tracking-[0.35em] text-light-200/70 animate-pulse">
          Cargando acceso
        </p>
      </div>
    )
  }

  // ── Firebase Auth gate ────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-main-900 text-light-200 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-light-100">Mi Cafetería</h1>
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
                <span className="h-px flex-1 bg-white/10" />o<span className="h-px flex-1 bg-white/10" />
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

  // ── Email gate — access denied ────────────────────────────────────────────
  if (emailCheck === 'denied') {
    return (
      <div
        className="fixed inset-0 bg-main-950 flex flex-col items-center justify-center p-6 select-none"
        style={{ zIndex: 9999, animation: 'pinFadeIn 150ms ease-out both' }}
      >
        <style>{`@keyframes pinFadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
        <div className="w-full max-w-[320px] flex flex-col items-center gap-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <ShieldOff size={28} className="text-rose-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-light-100">Acceso no autorizado</h1>
            <p className="text-sm text-light-200/50">
              El correo <span className="text-light-200/80 font-medium">{user?.email}</span> no está en la lista de accesos autorizados.
            </p>
            <p className="text-xs text-light-200/30">
              Pide al administrador que agregue tu correo desde el panel de configuración.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-semibold hover:bg-rose-500/20 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  // ── Authenticated + authorized (or no-list) — render admin panel ──────────
  return (
    <div className="h-screen overflow-hidden bg-main-950 flex">
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((v) => !v)} />

      <div
        className={`
          flex flex-col flex-1 min-w-0 overflow-hidden
          transition-all duration-300
          ${isCollapsed ? 'ml-20' : 'ml-60'}
        `}
      >
        <Topbar user={user} handleLogout={handleLogout} />

        <main className="flex-1 overflow-y-auto bg-main-900 rounded-tl-3xl border-t border-l border-white/5 p-6 md:p-8">
          {/* Pass emailCheck so Overview can show the no-emails warning */}
          <Outlet context={{ emailCheck }} />
        </main>
      </div>
    </div>
  )
}
