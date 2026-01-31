import React, { useEffect, useState } from 'react'
import Logo from '../assets/bklogo.svg'
import { NavLink } from 'react-router'
import Boba from '../assets/boba.svg'
import Croissant from '../assets/croissant.svg'

export const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Prevent background scroll when the mobile menu is open
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <>
      {/* Floating bars button on small screens */}
      <button
        type="button"
        onClick={() => setIsMobileMenuOpen((v) => !v)}
        className="sm:hidden fixed top-4 right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-main-600 text-light-200 shadow-2xl transition hover:bg-main-700 hover:text-light-400"
        aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={isMobileMenuOpen}
      >
        <i className={isMobileMenuOpen ? 'fas fa-xmark fa-lg' : 'fas fa-bars fa-lg'} />
      </button>

      {/* Mobile expanding bubble + full overlay layout */}
      <div
        className={
          "sm:hidden fixed inset-0 z-40 " +
          (isMobileMenuOpen ? "pointer-events-auto" : "pointer-events-none")
        }
        aria-hidden={!isMobileMenuOpen}
      >
        {/* Expanding circle background */}
        <div
          className={
            "fixed top-4 right-4 h-11 w-11 rounded-full bg-main-700 transition-transform duration-500 ease-in-out " +
            (isMobileMenuOpen ? "scale-[40]" : "scale-0")
          }
        />

        {/* Menu content */}
        <div
          className={
            "fixed inset-0 flex flex-col items-center justify-center gap-6 px-8 transition-opacity duration-300 " +
            (isMobileMenuOpen ? "opacity-100" : "opacity-0")
          }
        >
          <NavLink to="/" onClick={closeMobileMenu} className="flex items-center gap-3">
            <img src={Logo} alt="BK Logo" className="h-14" />
            <span className="text-2xl font-bold text-light-200">Bubble Kaapeh</span>
          </NavLink>

          <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
            <NavLink
              to="/bebidas"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                "w-full rounded-xl px-5 py-4 text-center text-lg font-semibold transition " +
                (isActive
                  ? "bg-white/25 text-light-200 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.35)]"
                  : "bg-white/10 text-light-200 hover:bg-white/15 hover:text-light-400")
              }
            >
              Bebidas
            </NavLink>

            <NavLink
              to="/alimentos"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                "w-full rounded-xl px-5 py-4 text-center text-lg font-semibold transition " +
                (isActive
                  ? "bg-white/25 text-light-200 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.35)]"
                  : "bg-white/10 text-light-200 hover:bg-white/15 hover:text-light-400")
              }
            >
              Alimentos
            </NavLink>
          </div>

          <button
            type="button"
            onClick={closeMobileMenu}
            className="mt-2 text-sm text-light-200/70 underline underline-offset-4 hover:text-light-200"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Full navbar hidden on small screens */}
      <div className="hidden sm:block bg-main-700 shadow-2xl fixed w-full z-40">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className='text-main-500'>
              <NavLink to="/">
                <img src={Logo} alt="BK Logo" className="h-14 fill-current" />
              </NavLink>
            </div>
          </div>
          <div className="flex items-center sm:gap-50 lg:gap-100">
            <NavLink
              to="/bebidas"
              className={({ isActive }) =>
                "text-light-200 text-xl transition hidden sm:block p-2 rounded-md " +
                (isActive
                  ? "text-light-400 bg-white/10 shadow-[inset_0_0_0_3px_rgba(255,255,255,0.18),inset_0_-10px_18px_rgba(69,26,3,0.45)]"
                  : "hover:text-light-400 hover:shadow-[inset_0_0_0_3px_rgba(69,26,3,0.55),inset_0_-10px_18px_rgba(69,26,3,0.5)]")
              }
            >
              <img src={Boba} alt="Bebidas" className="h-15 inline-block fill-current" />
            </NavLink>
            <NavLink
              to="/alimentos"
              className={({ isActive }) =>
                "text-light-200 transition hidden sm:block p-2 rounded-md " +
                (isActive
                  ? "text-light-400 bg-white/10 shadow-[inset_0_0_0_3px_rgba(255,255,255,0.18),inset_0_-10px_18px_rgba(69,26,3,0.45)]"
                  : "hover:text-light-400 hover:shadow-[inset_0_0_0_3px_rgba(69,26,3,0.55),inset_0_-10px_18px_rgba(69,26,3,0.5)]")
              }
            >
              <img src={Croissant} alt="Alimentos" className="h-15 inline-block transition" />
            </NavLink>
          </div>
        </div>
      </div>
    </>
  )
}
