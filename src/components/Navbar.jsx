import Logo from '../assets/bklogo.svg'
import { NavLink } from 'react-router'
import Boba from '../assets/Boba.svg'
import Croissant from '../assets/Croissant.svg'
import { MaskIcon } from './MaskIcon'

const LINKS = [
  { to: '/', label: 'Todo el menú', icon: null },
  { to: '/bebidas', label: 'Bebidas', icon: Boba },
  { to: '/alimentos', label: 'Alimentos', icon: Croissant },
]

// Desktop/tablet navbar (sm and up). On phones the MenuHero header carries
// the logo and the Todo / Bebidas / Alimentos filter instead.
// Height stays 104px — CategoryTabs, PromoCarousel and the section
// scroll-margin all offset by it.
export const Navbar = () => (
  <div className="hidden sm:block fixed w-full z-40 bg-primary text-surface">
    <div className="container mx-auto h-[104px] px-4 flex items-center justify-between gap-6">
      <NavLink to="/" aria-label="Bubble Kaapeh — inicio">
        <img src={Logo} alt="Bubble Kaapeh" className="h-14" />
      </NavLink>

      <nav aria-label="Filtrar menú" className="flex items-center gap-1 rounded-full bg-ink/25 p-1.5">
        {LINKS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              'inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[0.95rem] font-bold transition-all duration-200 ' +
              (isActive
                ? 'bg-surface text-primary shadow-[0_6px_14px_-6px_var(--color-ink)]'
                : 'text-surface/85 hover:bg-surface/10 hover:text-surface')
            }
          >
            {icon && <MaskIcon src={icon} className="h-6 w-6" />}
            {label}
          </NavLink>
        ))}
      </nav>
    </div>

    {/* Wavy bottom edge */}
    <svg
      className="absolute top-full left-0 block h-3 w-full text-primary"
      viewBox="0 0 400 12"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M0 0 L400 0 L400 4 C 350 12, 300 12, 250 5 S 150 -2, 100 6 S 30 12, 0 5 Z" fill="currentColor" />
    </svg>
  </div>
)
