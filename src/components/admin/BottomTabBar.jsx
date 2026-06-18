import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import {
  LayoutDashboard, ShoppingCart, ClipboardList, Users, MoreHorizontal,
  Landmark, BarChart3, Tag, UtensilsCrossed, ExternalLink,
} from 'lucide-react'

const PRIMARY_TABS = [
  { name: 'Overview',  path: '/admin',         icon: LayoutDashboard, end: true },
  { name: 'POS',       path: '/admin/pos',      icon: ShoppingCart },
  { name: 'Pedidos',   path: '/admin/pedidos',  icon: ClipboardList },
  { name: 'Clientes',  path: '/admin/clientes', icon: Users },
]

const MAS_ITEMS = [
  { name: 'Caja',        path: '/admin/caja',       icon: Landmark },
  { name: 'Métricas',    path: '/admin/metricas',    icon: BarChart3 },
  { name: 'Promociones', path: '/admin/promociones', icon: Tag },
  { name: 'Menú',        path: '/admin/menu',        icon: UtensilsCrossed },
]

export const BottomTabBar = () => {
  const [masOpen, setMasOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Close drawer automatically when route changes
  useEffect(() => { setMasOpen(false) }, [location.pathname])

  const isMasActive = MAS_ITEMS.some(
    item => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  )

  const handleMasNav = (path) => {
    setMasOpen(false)
    navigate(path)
  }

  return (
    <>
      {/* ── Bottom Tab Bar — mobile only ──────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-[60] bg-main-950/98 border-t border-white/8 backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', touchAction: 'manipulation' }}
      >
        <div className="flex items-stretch h-16">

          {PRIMARY_TABS.map(tab => (
            <NavLink
              key={tab.name}
              to={tab.path}
              end={tab.end}
              className={({ isActive }) => `
                flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer
                transition-colors duration-200 select-none
                ${isActive ? 'text-main-400' : 'text-light-200/35'}
              `}
            >
              {({ isActive }) => (
                <>
                  <div className={`
                    h-8 w-8 flex items-center justify-center rounded-xl
                    transition-all duration-200
                    ${isActive ? 'bg-main-500/25' : ''}
                  `}>
                    <tab.icon size={21} />
                  </div>
                  <span className="text-[9px] font-medium leading-none tracking-wide">{tab.name}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Más tab */}
          <button
            type="button"
            onClick={() => setMasOpen(v => !v)}
            aria-label="Más opciones de navegación"
            className={`
              flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer
              transition-colors duration-200 select-none
              ${isMasActive || masOpen ? 'text-main-400' : 'text-light-200/35'}
            `}
          >
            <div className={`
              h-8 w-8 flex items-center justify-center rounded-xl
              transition-all duration-200
              ${isMasActive || masOpen ? 'bg-main-500/25' : ''}
            `}>
              <MoreHorizontal size={21} />
            </div>
            <span className="text-[9px] font-medium leading-none tracking-wide">Más</span>
          </button>

        </div>
      </nav>

      {/* ── Más Drawer ────────────────────────────────────────────────────── */}
      {masOpen && (
        <div
          className="md:hidden fixed inset-0 z-[65] flex flex-col justify-end"
          style={{ touchAction: 'none' }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMasOpen(false)}
          />

          {/* Sheet */}
          <div
            className="relative bg-main-900 rounded-t-[20px] border-t border-white/8"
            style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-0">
              <div className="w-10 h-[4px] rounded-full bg-light-200/20" />
            </div>

            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-light-200/30 px-5 pt-3 pb-2">
              Más opciones
            </p>

            {/* 4-col grid of nav items */}
            <div className="px-4 pb-4 grid grid-cols-4 gap-2">
              {MAS_ITEMS.map(item => {
                const isActive = location.pathname === item.path ||
                  location.pathname.startsWith(item.path + '/')
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleMasNav(item.path)}
                    className={`
                      flex flex-col items-center justify-center gap-2.5 py-4 rounded-2xl border
                      cursor-pointer transition-all duration-200 active:scale-[0.96] select-none
                      ${isActive
                        ? 'bg-main-500/20 border-main-500/30 text-main-400'
                        : 'bg-main-950/70 border-white/5 text-light-200/60 hover:bg-main-800/60 hover:border-white/10 hover:text-light-100'}
                    `}
                  >
                    <item.icon size={22} />
                    <span className="text-[11px] font-medium leading-none">{item.name}</span>
                  </button>
                )
              })}
            </div>

            {/* Ver menú link */}
            <div className="mx-4 mb-1 border-t border-white/5">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm text-light-200/35 hover:text-light-100 hover:bg-white/5 transition-all"
              >
                <ExternalLink size={16} />
                Ver menú público
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
