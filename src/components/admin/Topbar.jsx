/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router'
import { LogOut, User, Bell } from 'lucide-react'

export const Topbar = ({ user, handleLogout }) => {
  const location = useLocation()
  const [dateTime, setDateTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/admin') return 'Overview'
    if (path === '/admin/pedidos') return 'Pedidos'
    if (path === '/admin/metricas') return 'Métricas'
    if (path === '/admin/promociones') return 'Promociones'
    if (path === '/admin/menu') return 'Editor de Menú'
    if (path === '/admin/legacy') return 'Menu Editor (Legacy)'
    return 'Admin'
  }

  const formattedDate = dateTime.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-main-950 border-b border-white/5 sticky top-0 z-40">
      <div>
        <h1 className="text-lg font-semibold text-light-100">{getPageTitle()}</h1>
        <p className="text-xs text-light-200/40 capitalize">{formattedDate}</p>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full hover:bg-white/5 text-light-200/60 transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-main-500 rounded-full border-2 border-main-950"></span>
        </button>

        <div className="h-8 w-px bg-white/5 mx-1"></div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-light-100">{user?.displayName || 'Admin'}</p>
            <p className="text-[10px] text-light-200/40 truncate max-w-[120px]">{user?.email}</p>
          </div>
          <div className="relative group">
            <button className="h-9 w-9 rounded-xl bg-main-800 border border-white/10 flex items-center justify-center overflow-hidden hover:border-white/20 transition-all">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <User size={20} className="text-light-200/60" />
              )}
            </button>
            
            <div className="absolute right-0 mt-2 w-48 bg-main-900 border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
