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

// "¿Cómo funciona esta sección?" — 2–4 plain-language steps shown at the top
// of each page (PageGuide in AdminLayout). Cobrar has none on purpose: the
// till needs every pixel and is learned by doing.
export const PAGE_GUIDES = {
  overview: [
    'Arriba ves cuánto llevas vendido hoy comparado con ayer.',
    'Los accesos rápidos te llevan a lo que más se usa durante el día.',
    'Los pedidos recientes y el historial de caja te dicen cómo va el turno.',
  ],
  pedidos: [
    'Aquí aparece cada pedido desde que se toma hasta que se cobra.',
    'Avanza el pedido con su botón: Nuevo → Preparando → Listo → Pagado.',
    'Un pedido cuenta como venta (en Finanzas e Inicio) solo cuando queda Pagado.',
    'Si te equivocaste en un pedido ya cobrado, usa Reembolsar.',
  ],
  caja: [
    'Al empezar el día, abre la caja con el efectivo que hay en el cajón.',
    'Cada cobro en efectivo o tarjeta se suma solo; registra aquí entradas y salidas de efectivo (cambio, compras).',
    'Al cerrar, cuenta el efectivo: verás si sobra o falta contra lo que debería haber.',
  ],
  menu: [
    'Productos y secciones son lo que ven tus clientes en el menú digital.',
    'Los cambios se publican al guardar; puedes marcar un producto como agotado sin borrarlo.',
    'Las opciones (tamaño, sabor) y extras cambian el precio automáticamente.',
  ],
  promociones: [
    'Escribe un aviso corto (ej. "2×1 en frappés los martes").',
    'Solo la promoción activa se muestra a los clientes al abrir el menú.',
  ],
  clientes: [
    'Al cobrar puedes vincular al cliente por nombre o teléfono.',
    'Cada compra le da saldo de recompensas que puede usar como pago después.',
    'Toca un cliente para ver sus visitas o ajustar su saldo.',
  ],
  stock: [
    'Insumos: registra todo lo que compras (leche, vasos, café…) con su costo y cuánto tienes.',
    'Recetas: indica qué insumos lleva cada producto. Así sabemos cuánto te cuesta y cuánto ganas.',
    'Cada venta descuenta sola los insumos de su receta. Cuando compres más, usa "Registrar compra".',
    'Pon un nivel de aviso a cada insumo y te avisaremos antes de que se acabe.',
  ],
  finanzas: [
    'Elige el periodo arriba (hoy, esta semana, este mes…).',
    'Vendiste − ingredientes − gastos fijos = lo que te quedó.',
    'Para que la ganancia sea real, cada producto necesita su receta (Inventario) y tus gastos fijos deben estar registrados (pestaña Gastos fijos).',
  ],
  metricas: [
    'Las ventas por día salen de la caja (efectivo + tarjeta cobrados ese día).',
    'Los productos más vendidos y el ticket promedio cuentan solo pedidos pagados.',
    'Para ganancias y costos, ve a Finanzas.',
  ],
  estaciones: [
    'Cada dispositivo del equipo entra como una estación con su propio PIN.',
    'Elige qué secciones puede abrir cada estación (por ejemplo, el cajero no ve Finanzas).',
    'Las estaciones de cocina reciben solo los productos que les corresponden.',
  ],
}

export const navItem = (routeKey) => ({ routeKey, ...NAV_ITEMS[routeKey] })

// Finds the nav item for the current pathname (used for the page header).
export const navItemForPath = (pathname) => {
  const key = Object.keys(NAV_ITEMS).find((k) => {
    const item = NAV_ITEMS[k]
    return item.end ? pathname === item.path : pathname === item.path || pathname.startsWith(item.path + '/')
  })
  return key ? navItem(key) : null
}
