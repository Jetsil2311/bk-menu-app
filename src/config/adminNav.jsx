import {
  LayoutDashboard, ClipboardList, BarChart3, Tag, UtensilsCrossed,
  ShoppingCart, Users, Landmark, Package, Wallet, ChefHat,
} from 'lucide-react'

// Single source of truth for admin nav items — used by Sidebar, BottomTabBar
// and the per-station disabledRoutes graying logic. routeKey must match the
// route path segments declared in src/main.jsx and ROUTE_KEYS in
// src/utils/stations.js.
export const NAV_ITEMS = {
  overview:    { name: 'Overview',     path: '/admin',              icon: LayoutDashboard, end: true },
  pos:         { name: 'POS',          path: '/admin/pos',          icon: ShoppingCart },
  caja:        { name: 'Caja',         path: '/admin/caja',         icon: Landmark },
  pedidos:     { name: 'Pedidos',      path: '/admin/pedidos',      icon: ClipboardList },
  clientes:    { name: 'Clientes',     path: '/admin/clientes',     icon: Users },
  stock:       { name: 'Stock',        path: '/admin/stock',        icon: Package },
  finanzas:    { name: 'Finanzas',     path: '/admin/finanzas',     icon: Wallet },
  metricas:    { name: 'Métricas',     path: '/admin/metricas',     icon: BarChart3 },
  promociones: { name: 'Promociones',  path: '/admin/promociones',  icon: Tag },
  menu:        { name: 'Menú',         path: '/admin/menu',         icon: UtensilsCrossed },
  estaciones:  { name: 'Estaciones',   path: '/admin/estaciones',   icon: ChefHat },
}

export const SIDEBAR_ORDER = [
  'overview', 'pos', 'caja', 'pedidos', 'clientes',
  'stock', 'finanzas', 'metricas', 'promociones', 'menu', 'estaciones',
]

export const BOTTOM_PRIMARY_ORDER = ['overview', 'pos', 'pedidos', 'clientes']
export const BOTTOM_MORE_ORDER = ['caja', 'stock', 'finanzas', 'metricas', 'promociones', 'menu', 'estaciones']

export const navItem = (routeKey) => ({ routeKey, ...NAV_ITEMS[routeKey] })
