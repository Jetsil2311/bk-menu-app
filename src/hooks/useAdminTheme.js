import { useCallback, useEffect, useState } from 'react'

// Admin light/dark theme. The choice is saved per device and applied as
// classes on <html> (see `html.admin-theme` / `.dark` in index.css):
//   admin-theme → admin palette is active (removed when leaving the admin)
//   dark        → dark tokens + Tailwind `dark:` utilities
// index.html applies the saved theme before first paint to avoid a flash.
export const ADMIN_THEME_KEY = 'bk_admin_theme'

const readSaved = () => {
  try {
    return localStorage.getItem(ADMIN_THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const useAdminTheme = () => {
  const [theme, setTheme] = useState(readSaved)

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('admin-theme')
    root.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem(ADMIN_THEME_KEY, theme) } catch { /* private mode */ }
  }, [theme])

  // Leaving the admin (e.g. "Ver menú") must restore the customer palette.
  useEffect(() => () => {
    document.documentElement.classList.remove('admin-theme', 'dark')
  }, [])

  const toggleTheme = useCallback(() => {
    const root = document.documentElement
    root.classList.add('theme-transition')
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
    window.setTimeout(() => root.classList.remove('theme-transition'), 250)
  }, [])

  return { theme, toggleTheme }
}
