import { NavLink } from 'react-router'
import Logo from '../assets/bklogo.svg'
import Boba from '../assets/Boba.svg'
import Croissant from '../assets/Croissant.svg'
import { Sparkles } from 'lucide-react'
import { MaskIcon } from './MaskIcon'

// Bubbles that float up behind the hero: [left %, size px, delay s]
const BUBBLES = [
  [8, 14, 0], [18, 22, 2.4], [30, 10, 4.1], [44, 18, 1.2],
  [58, 12, 3.3], [70, 24, 0.6], [82, 14, 2.9], [92, 18, 4.8],
]

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const FILTERS = [
  { to: '/', label: 'Todo', icon: null },
  { to: '/bebidas', label: 'Bebidas', icon: Boba },
  { to: '/alimentos', label: 'Alimentos', icon: Croissant },
]

// Mobile/tablet welcome header: logo, greeting, quick category filter,
// floating boba bubbles and a wavy bottom edge into the menu.
export const MenuHero = () => (
  <header className="md:hidden relative overflow-hidden bg-primary text-surface sm:pt-[104px]">
    {BUBBLES.map(([left, size, delay], i) => (
      <span
        key={i}
        className="bubble"
        style={{ left: `${left}%`, width: size, height: size, animationDelay: `${delay}s` }}
        aria-hidden="true"
      />
    ))}

    <div className="relative px-5 pt-7 pb-14 text-center">
      <img src={Logo} alt="Bubble Kaapeh" className="sm:hidden mx-auto h-14" />

      <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-surface/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-accent">
        <Sparkles size={13} aria-hidden="true" />
        {greeting()}
      </p>
      <h1 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.05]">
        ¿Qué se te antoja hoy?
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm text-surface/75">
        Toca cualquier producto para agregarlo y personalizarlo a tu gusto.
      </p>

      <nav aria-label="Filtrar menú" className="mt-6 inline-flex gap-1 rounded-full bg-ink/25 p-1.5">
        {FILTERS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              'inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-all duration-200 ' +
              (isActive
                ? 'bg-surface text-primary shadow-[0_6px_14px_-6px_var(--color-ink)]'
                : 'text-surface/85 hover:bg-surface/10')
            }
          >
            {icon && <MaskIcon src={icon} />}
            {label}
          </NavLink>
        ))}
      </nav>
    </div>

    {/* Wavy edge into the cream menu */}
    <svg
      className="absolute bottom-0 left-0 block h-8 w-full text-bg"
      viewBox="0 0 400 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M0 18 C 50 4, 100 4, 150 16 S 250 30, 300 16 S 370 4, 400 14 L400 32 L0 32 Z" fill="currentColor" />
    </svg>
  </header>
)
