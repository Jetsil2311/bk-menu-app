import { useEffect } from 'react'
import { NavLink } from 'react-router'
import { ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import PropTypes from 'prop-types'
import Logo from '../../assets/bklogo.svg'
import { SIDEBAR_GROUPS, navItem } from '../../config/adminNav'
import { useStationContext } from '../../context/StationContext'

export const Sidebar = ({ isCollapsed, onToggle }) => {
  // Persist collapse preference
  useEffect(() => {
    localStorage.setItem('admin_sidebar_collapsed', isCollapsed)
  }, [isCollapsed])

  const { selectedStation } = useStationContext()
  const disabledRoutes = selectedStation?.disabledRoutes || []

  const itemBase = `relative flex items-center gap-3 rounded-xl min-h-[44px] px-3 text-[0.925rem] font-semibold transition-colors duration-150 group ${
    isCollapsed ? 'justify-center' : ''
  }`

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
        hidden md:flex flex-col
        bg-main-900 text-light-100
        border-r border-white/10
        transition-[width] duration-300 overflow-hidden
        ${isCollapsed ? 'w-20' : 'w-60'}
      `}
    >
      {/* ── Brand ── */}
      <div className="shrink-0 p-3">
        <NavLink
          to="/admin"
          end
          aria-label="Bubble Kaapeh — Inicio"
          className={`flex items-center rounded-2xl bg-primary px-3 h-14 ${isCollapsed ? 'justify-center' : 'gap-3'}`}
        >
          <img src={Logo} alt="" className={isCollapsed ? 'h-6 w-auto' : 'h-8 w-auto'} />
          {!isCollapsed && (
            <span className="ml-auto rounded-full bg-snow/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-snow/90">
              Panel
            </span>
          )}
        </NavLink>
      </div>

      {/* ── Grouped nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Secciones del panel">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.label} className="mt-4 first:mt-1">
            {isCollapsed ? (
              <div className="mx-auto mb-2 h-px w-8 bg-white/10" aria-hidden="true" />
            ) : (
              <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-light-200/55">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(navItem).map((item) => {
                const isDisabled = disabledRoutes.includes(item.routeKey)
                const Icon = item.icon

                if (isDisabled) {
                  return (
                    <div
                      key={item.routeKey}
                      aria-disabled="true"
                      title="No disponible para esta estación"
                      className={`${itemBase} text-light-200/45 opacity-50 pointer-events-none select-none`}
                    >
                      <Icon size={20} className="shrink-0" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </div>
                  )
                }

                return (
                  <NavLink
                    key={item.routeKey}
                    to={item.path}
                    end={item.end}
                    title={isCollapsed ? item.name : undefined}
                    className={({ isActive }) => `${itemBase} ${
                      isActive
                        ? 'bg-primary/10 text-primary dark:text-main-300'
                        : 'text-light-200/80 hover:bg-white/5 hover:text-light-100'
                    }`}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !isCollapsed && (
                          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" aria-hidden="true" />
                        )}
                        <Icon size={20} strokeWidth={isActive ? 2.4 : 2} className="shrink-0" />
                        {!isCollapsed && <span>{item.name}</span>}

                        {/* Tooltip shown in icon-only mode */}
                        {isCollapsed && (
                          <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-light-100 text-xs font-semibold text-main-900 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">
                            {item.name}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="shrink-0 p-3 border-t border-white/10 space-y-0.5">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title={isCollapsed ? 'Ver menú público' : undefined}
          className={`${itemBase} text-light-200/70 hover:bg-white/5 hover:text-light-100`}
        >
          <ExternalLink size={20} className="shrink-0" />
          {!isCollapsed && <span>Ver menú público</span>}
        </a>
        <button
          type="button"
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          className={`${itemBase} w-full text-light-200/70 hover:bg-white/5 hover:text-light-100 cursor-pointer`}
        >
          {isCollapsed ? <PanelLeftOpen size={20} className="shrink-0" /> : <PanelLeftClose size={20} className="shrink-0" />}
          {!isCollapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  )
}

Sidebar.propTypes = {
  isCollapsed: PropTypes.bool.isRequired,
  onToggle:    PropTypes.func.isRequired,
}
