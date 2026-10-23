import {
  LayoutDashboard, ClipboardList, BarChart3, Tag, UtensilsCrossed,
  ShoppingCart, Users, Landmark, Package, Wallet, ChefHat,
} from 'lucide-react'

// Single source of truth for admin nav items — used by Sidebar, BottomTabBar,
// Topbar (page title + description) and the per-station disabledRoutes
// graying logic. routeKey must match the route path segments declared in
// src/main.jsx and ROUTE_KEYS in src/utils/stations.js.
export const NAV_ITEMS = {
  overview:    { name: 'Inicio',       path: '/admin',              icon: LayoutDashboard, end: true, desc: 'Resumen del día: ventas, pedidos recientes y accesos rápidos.' },
  pos:         { name: 'Cobrar',       path: '/admin/pos',          icon: ShoppingCart,    desc: 'Arma el pedido del cliente en mostrador y cóbralo.' },
  caja:        { name: 'Caja',         path: '/admin/caja',         icon: Landmark,        desc: 'Abre y cierra la caja del día, registra entradas y salidas de efectivo.' },
  pedidos:     { name: 'Pedidos',      path: '/admin/pedidos',      icon: ClipboardList,   desc: 'Sigue cada pedido desde que llega hasta que se entrega.' },
  clientes:    { name: 'Clientes',     path: '/admin/clientes',     icon: Users,           desc: 'Clientes registrados, visitas y saldo de lealtad.' },
  stock:       { name: 'Inventario',   path: '/admin/stock',        icon: Package,         desc: 'Materia prima, compras y recetas de cada producto.' },
  finanzas:    { name: 'Finanzas',     path: '/admin/finanzas',     icon: Wallet,          desc: 'Ingresos, costos, ganancia y gastos fijos del negocio.' },
  metricas:    { name: 'Métricas',     path: '/admin/metricas',     icon: BarChart3,       desc: 'Cómo van las ventas y qué productos se venden más.' },
  promociones: { name: 'Promociones',  path: '/admin/promociones',  icon: Tag,             desc: 'El aviso de promoción que ven los clientes en el menú.' },
  menu:        { name: 'Menú',         path: '/admin/menu',         icon: UtensilsCrossed, desc: 'Productos, secciones, extras y el carrusel del menú digital.' },
  estaciones:  { name: 'Estaciones',   path: '/admin/estaciones',   icon: ChefHat,         desc: 'Dispositivos del equipo: PIN, permisos y qué pedidos recibe la cocina.' },
}

// Sidebar groups — what staff do day to day first, owner tools after.
export const SIDEBAR_GROUPS = [
  { label: 'Operación', items: ['overview', 'pos', 'pedidos', 'caja'] },
  { label: 'Menú y clientes', items: ['menu', 'promociones', 'clientes'] },
  { label: 'Negocio', items: ['stock', 'finanzas', 'metricas'] },
  { label: 'Ajustes', items: ['estaciones'] },
]

export const SIDEBAR_ORDER = SIDEBAR_GROUPS.flatMap((g) => g.items)

export const BOTTOM_PRIMARY_ORDER = ['overview', 'pos', 'pedidos', 'caja']
export const BOTTOM_MORE_ORDER = ['menu', 'promociones', 'clientes', 'stock', 'finanzas', 'metricas', 'estaciones']

export const navItem = (routeKey) => ({ routeKey, ...NAV_ITEMS[routeKey] })

// Finds the nav item for the current pathname (used for the page header).
export const navItemForPath = (pathname) => {
  const key = Object.keys(NAV_ITEMS).find((k) => {
    const item = NAV_ITEMS[k]
    return item.end ? pathname === item.path : pathname === item.path || pathname.startsWith(item.path + '/')
  })
  return key ? navItem(key) : null
}
