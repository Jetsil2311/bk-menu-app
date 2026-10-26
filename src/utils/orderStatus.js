// Status values that represent a completed/paid order, including legacy aliases
// used before the current status vocabulary ('Nuevo'/'Preparando'/'Listo'/'Pagado')
// was established — mirrors Orders.jsx's own normalizeStatus() 'entregado' → 'Pagado' rule.
const PAID_STATUSES = new Set(['pagado', 'entregado'])

export const isPaidOrderStatus = (status) => PAID_STATUSES.has((status || '').toLowerCase())

// Statuses of an order still being made (kitchen board, "En curso" in Cobrar),
// including legacy spellings. Used in Firestore `in` queries so those screens
// read only live orders instead of the whole (now uncapped) orders history.
export const ACTIVE_STATUSES = ['Nuevo', 'Preparando', 'Listo', 'nuevo', 'preparando', 'listo', 'En preparación', 'en preparación']
