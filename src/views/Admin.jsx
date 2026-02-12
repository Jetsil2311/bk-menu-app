import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router'
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'

export const Admin = () => {
  const ALLOWED_EMAILS = ['jethrosiloe26@gmail.com']
  const [user, setUser] = useState(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const googleProvider = useMemo(() => new GoogleAuthProvider(), [])

  const isAllowedEmail = (email) =>
    Boolean(email) &&
    ALLOWED_EMAILS.map((item) => item.toLowerCase()).includes(email.toLowerCase())

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && !isAllowedEmail(currentUser.email)) {
        setError('Tu cuenta no tiene acceso al panel.')
        signOut(auth)
        setUser(null)
        setIsAuthReady(true)
        return
      }

      setUser(currentUser)
      setIsAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  const isAuthenticated = useMemo(() => Boolean(user), [user])

  const handleLogin = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      setPassword('')
    } catch (err) {
      setError('No se pudo iniciar sesión. Revisa tu correo y contraseña.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const result = await signInWithPopup(auth, googleProvider)
      if (!isAllowedEmail(result.user?.email)) {
        setError('Tu cuenta no tiene acceso al panel.')
        await signOut(auth)
      }
    } catch (err) {
      setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
  }

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-main-900 text-light-200 flex items-center justify-center">
        <p className="text-sm uppercase tracking-[0.35em] text-light-200/70">
          Cargando acceso
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-main-900 text-light-200">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-main-800/95 backdrop-blur">
          <div className="container mx-auto flex items-center justify-between px-4 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-light-200/70">
                Admin Panel
              </p>
              <h1 className="text-2xl font-semibold">Bubble Kaapeh</h1>
            </div>
            <NavLink
              to="/"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
            >
              Volver al menú
            </NavLink>
          </div>
        </header>

        <main className="container mx-auto px-4 pb-12 pt-28">
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-main-800/60 p-6 shadow-[0_28px_60px_rgba(0,0,0,0.45)]">
            <h2 className="text-xl font-semibold">Inicia sesión</h2>
            <p className="mt-2 text-sm text-light-200/70">
              Acceso restringido solo para administradores.
            </p>

            <form className="mt-6 grid gap-4" onSubmit={handleLogin}>
              <label className="grid gap-2 text-sm">
                Correo
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm">
                Contraseña
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </label>

              {error && (
                <p className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl border border-white/20 bg-main-900/70 px-4 py-3 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="flex items-center gap-3 text-xs text-light-200/50">
                <span className="h-px flex-1 bg-white/10" />
                o
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Conectando...' : 'Entrar con Google'}
              </button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-main-900 text-light-200">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-main-800/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-light-200/70">Admin Panel</p>
            <h1 className="text-2xl font-semibold">Bubble Kaapeh</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
            >
              Cerrar sesión
            </button>
            <NavLink
              to="/"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
            >
              Volver al menú
            </NavLink>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-12 pt-28">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-main-800/60 p-6 shadow-[0_28px_60px_rgba(0,0,0,0.45)]">
            <h2 className="text-xl font-semibold">Resumen rápido</h2>
            <p className="mt-2 text-sm text-light-200/70">
              Aquí verás los pedidos recientes, alertas de inventario y notas del día.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Pedidos hoy', value: '18' },
                { label: 'Ingresos', value: '$3,420' },
                { label: 'Artículos bajos', value: '4' },
                { label: 'Promedio ticket', value: '$190' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-main-900/70 p-4"
                >
                  <p className="text-xs uppercase tracking-widest text-light-200/60">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-light-200">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-main-800/60 p-6">
            <h2 className="text-xl font-semibold">Acciones rápidas</h2>
            <div className="mt-5 grid gap-3">
              {[
                'Agregar producto',
                'Actualizar precios',
                'Revisar inventario',
                'Programar promociones',
              ].map((action) => (
                <button
                  key={action}
                  type="button"
                  className="rounded-2xl border border-white/15 bg-main-900/60 px-4 py-3 text-left text-sm font-semibold transition hover:border-white/35 hover:text-light-400"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-main-800/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Pedidos recientes</h2>
              <p className="text-sm text-light-200/70">
                Panel de control listo para integrar datos reales.
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
            >
              Ver todo
            </button>
          </div>
          <div className="mt-5 grid gap-3">
            {[
              { id: '#BK-1042', status: 'En preparación', total: '$220' },
              { id: '#BK-1041', status: 'Listo para envío', total: '$180' },
              { id: '#BK-1040', status: 'Entregado', total: '$260' },
            ].map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-light-200">{order.id}</p>
                  <p className="text-xs text-light-200/60">{order.status}</p>
                </div>
                <p className="text-sm font-semibold text-light-200">{order.total}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
