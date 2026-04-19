import { useEffect } from 'react'
import { NavLink } from 'react-router'
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Tag,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShoppingCart,
  Users,
  Landmark,
} from 'lucide-react'
import PropTypes from 'prop-types'

export const Sidebar = ({ isCollapsed, onToggle }) => {
  // Persist collapse preference
  useEffect(() => {
    localStorage.setItem('admin_sidebar_collapsed', isCollapsed)
  }, [isCollapsed])

  const navItems = [
    { name: 'Overview',     path: '/admin',              icon: LayoutDashboard, end: true },
    { name: 'POS',          path: '/admin/pos',          icon: ShoppingCart },
    { name: 'Caja',         path: '/admin/caja',         icon: Landmark },
    { name: 'Pedidos',      path: '/admin/pedidos',      icon: ClipboardList },
    { name: 'Clientes',     path: '/admin/clientes',     icon: Users },
    { name: 'Métricas',     path: '/admin/metricas',     icon: BarChart3 },
    { name: 'Promociones',  path: '/admin/promociones',  icon: Tag },
    { name: 'Menú',         path: '/admin/menu',         icon: UtensilsCrossed },
  ]

  return (
    /*
     * Always fixed — never participates in page flow.
     * Width transitions are driven by the `isCollapsed` prop so that
     * AdminLayout can mirror the same value as a margin-left offset on
     * the content wrapper, keeping them perfectly in sync.
     */
    <aside
      className={`
        fixed inset-y-0 left-0 z-50
        flex flex-col
        bg-main-950 text-light-200
        border-r border-white/5
        transition-all duration-300 overflow-hidden
        ${isCollapsed ? 'w-20' : 'w-60'}
      `}
    >
      {/* ── Brand header — flex-shrink-0 keeps it always visible ── */}
      <div className="flex-shrink-0 h-16 flex items-center px-4 border-b border-white/5">
        {!isCollapsed && (
          <span className="flex-1 text-lg font-bold tracking-tight text-light-100 truncate">
            Bubble Kaapeh
          </span>
        )}
        <button
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          className={`
            p-1.5 rounded-lg
            hover:bg-white/5 text-light-200/60
            transition-colors cursor-pointer
            ${isCollapsed ? 'mx-auto' : 'ml-auto'}
          `}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* ── Nav links — flex-1 + overflow-y-auto in case of many items ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.end}
            className={({ isActive }) => `
              relative flex items-center gap-3 px-3 py-2.5 rounded-xl
              transition-all duration-200 group
              ${isActive
                ? 'bg-main-500 text-white shadow-lg shadow-main-500/20'
                : 'text-light-200/60 hover:bg-white/5 hover:text-light-100'}
            `}
          >
            <item.icon size={22} className={`shrink-0 ${isCollapsed ? 'mx-auto' : ''}`} />
            {!isCollapsed && <span className="font-medium">{item.name}</span>}

            {/* Tooltip shown in icon-only mode */}
            {isCollapsed && (
              <span className="
                absolute left-full ml-3 px-2 py-1
                bg-main-800 border border-white/10
                text-xs text-light-200 rounded-lg
                opacity-0 pointer-events-none
                group-hover:opacity-100
                transition-opacity whitespace-nowrap z-[60]
              ">
                {item.name}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer link — flex-shrink-0 keeps it pinned to the bottom ── */}
      <div className="flex-shrink-0 p-3 border-t border-white/5">
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

Sidebar.propTypes = {
  isCollapsed: PropTypes.bool.isRequired,
  onToggle:    PropTypes.func.isRequired,
}
