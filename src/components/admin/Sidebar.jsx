import { useState, useEffect } from 'react'
import { NavLink } from 'react-router'
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Tag,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react'

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('admin_sidebar_collapsed')
    return saved === 'true'
  })

  useEffect(() => {
    localStorage.setItem('admin_sidebar_collapsed', isCollapsed)
  }, [isCollapsed])

  const navItems = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard, end: true },
    { name: 'Pedidos', path: '/admin/pedidos', icon: ClipboardList },
    { name: 'Métricas', path: '/admin/metricas', icon: BarChart3 },
    { name: 'Promociones', path: '/admin/promociones', icon: Tag },
    { name: 'Menú', path: '/admin/menu', icon: UtensilsCrossed },
  ]

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 bg-main-950 text-light-200 transition-all duration-300 border-r border-white/5 flex flex-col
        ${isCollapsed ? 'w-20' : 'w-60'} md:relative md:translate-x-0`}
    >
      <div className="h-16 flex items-center px-6 border-b border-white/5">
        {!isCollapsed && (
          <span className="text-lg font-bold tracking-tight text-light-100 truncate">Bubble Kaapeh</span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 rounded-lg hover:bg-white/5 text-light-200/60 transition-colors ${isCollapsed ? 'mx-auto' : 'ml-auto'}`}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.end}
            className={({ isActive }) => `
              relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
              ${isActive
                ? 'bg-main-500 text-white shadow-lg shadow-main-500/20'
                : 'text-light-200/60 hover:bg-white/5 hover:text-light-100'}
            `}
          >
            <item.icon size={22} className={`shrink-0 ${isCollapsed ? 'mx-auto' : ''}`} />
            {!isCollapsed && <span className="font-medium">{item.name}</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-main-800 text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">
                {item.name}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-white/5">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-light-200/40 hover:bg-white/5 hover:text-light-100 transition-all duration-200"
        >
          <ExternalLink size={22} className={`shrink-0 ${isCollapsed ? 'mx-auto' : ''}`} />
          {!isCollapsed && <span className="font-medium text-sm">Ver menú</span>}
        </a>
      </div>
    </aside>
  )
}
