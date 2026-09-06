import { useState } from 'react'
import { ChefHat } from 'lucide-react'
import { useStationContext } from '../../context/StationContext'
import { ROLE_LABELS, ROLE_ICONS } from '../../utils/stations'
import { PinKeypad } from './PinKeypad'

// Full-screen station picker. Not a security boundary (the PIN is
// app-level only) — matches the original single shared-PIN system's own
// caveat, just scoped per-station now instead of per-route.
export const StationGate = () => {
  const { stations, selectStation, loading } = useStationContext()
  const [activeStation, setActiveStation] = useState(null)

  if (loading) {
    return (
      <div className="min-h-screen bg-main-950 flex items-center justify-center">
        <p className="text-sm uppercase tracking-[0.35em] text-light-200/70 animate-pulse">
          Cargando estaciones
        </p>
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
    <div className="min-h-screen bg-main-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-light-100">Bubble Kaapeh</h1>
          <p className="mt-2 text-sm text-light-200/60">Selecciona tu estación</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {stations.map((station) => {
            const Icon = ROLE_ICONS[station.role] || ChefHat
            return (
              <button
                key={station.id}
                type="button"
                onClick={() => setActiveStation(station)}
                className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-main-800/60 p-6 hover:border-main-400/40 hover:bg-main-800 transition-all cursor-pointer"
              >
                <div className="h-14 w-14 rounded-2xl bg-main-500/15 border border-main-500/20 flex items-center justify-center text-main-300">
                  <Icon size={26} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-light-100">{station.name}</p>
                  <p className="text-xs text-light-200/40 mt-0.5">{ROLE_LABELS[station.role] || station.role}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
