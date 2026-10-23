import { useState } from 'react'
import { ChefHat } from 'lucide-react'
import { useStationContext } from '../../context/StationContext'
import { ROLE_LABELS, ROLE_ICONS } from '../../utils/stations'
import { PinKeypad } from './PinKeypad'
import Logo from '../../assets/bklogo.svg'

// Plain-language summary of what each role sees, shown on the picker cards.
const ROLE_HINTS = {
  admin: 'Acceso completo al panel',
  cajero: 'Cobrar, pedidos y caja',
  kitchen: 'Pantalla de pedidos en cocina',
}

// Full-screen station picker. Not a security boundary (the PIN is
// app-level only) — matches the original single shared-PIN system's own
// caveat, just scoped per-station now instead of per-route.
export const StationGate = () => {
  const { stations, selectStation, loading } = useStationContext()
  const [activeStation, setActiveStation] = useState(null)

  if (loading) {
    return (
      <div className="min-h-dvh bg-main-950 flex items-center justify-center">
        <p className="text-sm font-semibold text-light-200/70 animate-pulse">Cargando estaciones…</p>
      </div>
    )
  }

  if (activeStation) {
    return (
      <div className="fixed inset-0 bg-main-950 flex flex-col items-center justify-center overflow-y-auto p-6 select-none">
        <PinKeypad
          title={activeStation.name}
          subtitle="Ingresa el PIN de esta estación"
          onCancel={() => setActiveStation(null)}
          onComplete={(pin, { shake, reset }) => {
            if (pin === activeStation.pin) {
              selectStation(activeStation)
            } else {
              shake('PIN incorrecto, intenta de nuevo')
              reset()
            }
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-main-950 text-light-100 font-body flex items-center justify-center p-5">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex rounded-2xl bg-primary px-5 py-3.5">
            <img src={Logo} alt="Bubble Kaapeh" className="h-9" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold">¿Quién usa este dispositivo?</h1>
          <p className="mt-2 text-sm text-light-200/70">Elige tu estación y escribe su PIN para entrar.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {stations.map((station) => {
            const Icon = ROLE_ICONS[station.role] || ChefHat
            const roleLabel = ROLE_LABELS[station.role] || station.role
            return (
              <button
                key={station.id}
                type="button"
                onClick={() => setActiveStation(station)}
                className="group flex sm:flex-col items-center gap-4 sm:gap-3 rounded-3xl bg-main-900 p-5 sm:p-7 text-left sm:text-center ring-1 ring-white/10 shadow-[0_12px_30px_-22px_var(--color-ink)] hover:ring-primary/40 hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary dark:text-main-300 group-hover:bg-primary group-hover:text-snow transition-colors">
                  <Icon size={26} />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold">{station.name}</p>
                  <p className="text-xs text-light-200/70 mt-0.5">
                    {station.name !== roleLabel ? `${roleLabel} · ` : ''}{ROLE_HINTS[station.role] || ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
