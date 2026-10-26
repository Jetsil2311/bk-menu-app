// "About to run out" rule shared by Inventario, the nav warning and the
// stock notifications: a material is low once its stock is at or below the
// "Avisarme cuando queden" level the owner set for it (reorderLevel).
// Materials without that level never warn.

export const isLowStock = (material) => {
  const level = Number(material?.reorderLevel) || 0
  return level > 0 && (Number(material?.currentStock) || 0) <= level
}

export const isOutOfStock = (material) =>
  (Number(material?.reorderLevel) || 0) > 0 && (Number(material?.currentStock) || 0) <= 0

// Lowest first (relative to its own warning level), so "already empty"
// items lead every list.
export const lowStockList = (materials = []) =>
  materials
    .filter(isLowStock)
    .sort((a, b) =>
      (Number(a.currentStock) || 0) / (Number(a.reorderLevel) || 1)
      - (Number(b.currentStock) || 0) / (Number(b.reorderLevel) || 1))
