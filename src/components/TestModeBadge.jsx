import { FlaskConical } from 'lucide-react'
import { isTestEnv } from '../firebase'

// Always-visible reminder that the app is running against the local test
// database (npm run dev:test). Renders nothing in normal/production builds.
export const TestModeBadge = () => {
  if (!isTestEnv) return null
  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-2 z-[10000] -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-950 shadow-lg ring-2 ring-amber-950/10"
    >
      <FlaskConical size={13} aria-hidden="true" />
      Modo prueba · datos locales
    </div>
  )
}
