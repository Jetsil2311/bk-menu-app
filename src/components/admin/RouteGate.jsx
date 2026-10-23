import PropTypes from 'prop-types'
import { NavLink } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import { useStationContext } from '../../context/StationContext'

// Replaces the old SmartPinGate. Blocks direct URL access to a route the
// current station has disabled (the Sidebar/BottomTabBar already gray these
// out visually — this is the actual enforcement so graying isn't cosmetic).
export const RouteGate = ({ routeKey, children }) => {
  const { selectedStation } = useStationContext()
  const isDisabled = (selectedStation?.disabledRoutes || []).includes(routeKey)

  if (!isDisabled) return children

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
        <ShieldAlert size={26} />
      </div>
      <div>
        <p className="font-semibold text-light-100">No disponible para esta estación</p>
        <p className="text-sm text-light-200/70 mt-1">Esta pantalla fue deshabilitada para la estación actual.</p>
      </div>
      <NavLink
        to="/admin/pedidos"
        className="text-sm font-medium text-main-300 hover:text-main-200 transition-colors"
      >
        Ir a Pedidos
      </NavLink>
    </div>
  )
}

RouteGate.propTypes = {
  routeKey: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
}
