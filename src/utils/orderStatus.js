// Status values that represent a completed/paid order, including legacy aliases
// used before the current status vocabulary ('Nuevo'/'Preparando'/'Listo'/'Pagado')
// was established — mirrors Orders.jsx's own normalizeStatus() 'entregado' → 'Pagado' rule.
const PAID_STATUSES = new Set(['pagado', 'entregado'])

export const isPaidOrderStatus = (status) => PAID_STATUSES.has((status || '').toLowerCase())
