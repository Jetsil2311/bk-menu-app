import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { MoreHorizontal, ExternalLink } from 'lucide-react'
import { BOTTOM_PRIMARY_ORDER, BOTTOM_MORE_ORDER, navItem } from '../../config/adminNav'
import { useStationContext } from '../../context/StationContext'

export const BottomTabBar = () => {
  const [masOpen, setMasOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { selectedStation } = useStationContext()
  const disabledRoutes = selectedStation?.disabledRoutes || []

  const primaryTabs = BOTTOM_PRIMARY_ORDER.map(navItem)
  const moreItems = BOTTOM_MORE_ORDER.map(navItem)

  // Close drawer automatically when route changes
  useEffect(() => { setMasOpen(false) }, [location.pathname])

  const isMasActive = moreItems.some(
    item => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  )

  const handleMasNav = (path, routeKey) => {
    if (disabledRoutes.includes(routeKey)) return
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

          {primaryTabs.map(tab => {
            const isDisabled = disabledRoutes.includes(tab.routeKey)

            if (isDisabled) {
              return (
                <div
                  key={tab.routeKey}
                  aria-disabled="true"
                  title="No disponible para esta estación"
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 opacity-40 pointer-events-none select-none text-light-200/35"
                >
                  <div className="h-8 w-8 flex items-center justify-center rounded-xl">
                    <tab.icon size={21} />
                  </div>
                  <span className="text-[9px] font-medium leading-none tracking-wide">{tab.name}</span>
                </div>
              )
            }

            return (
              <NavLink
                key={tab.routeKey}
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
            )
          })}

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
              {moreItems.map(item => {
                const isActive = location.pathname === item.path ||
                  location.pathname.startsWith(item.path + '/')
                const isDisabled = disabledRoutes.includes(item.routeKey)
                return (
                  <button
                    key={item.routeKey}
                    type="button"
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    title={isDisabled ? 'No disponible para esta estación' : undefined}
                    onClick={() => handleMasNav(item.path, item.routeKey)}
                    className={`
                      flex flex-col items-center justify-center gap-2.5 py-4 rounded-2xl border
                      transition-all duration-200 select-none
                      ${isDisabled
                        ? 'opacity-40 pointer-events-none bg-main-950/70 border-white/5 text-light-200/35'
                        : `cursor-pointer active:scale-[0.96] ${isActive
                          ? 'bg-main-500/20 border-main-500/30 text-main-400'
                          : 'bg-main-950/70 border-white/5 text-light-200/60 hover:bg-main-800/60 hover:border-white/10 hover:text-light-100'}`}
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
