// Attaches cost data to a paid order's items and deducts the consumed raw
// materials from stock. Called at the exact moment an order becomes "Pagado" —
// from POS.jsx (direct charge) or Orders.jsx (Listo → Pagado transition).
//
// Deliberately client-side (writeBatch), not a Cloud Function: this project has
// no Cloud Functions infrastructure and no Blaze billing plan configured, and
// every other money-critical write in this codebase (register totals, loyalty
// balance, refunds) already follows this same pattern.
import {
  collection, doc, getDocs, query, where, documentId,
  writeBatch, increment, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const CHUNK_SIZE = 30 // Firestore 'in' query cap

const fetchByIds = async (collectionName, ids) => {
  const byId = {}
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE)
    if (chunk.length === 0) continue
    const snap = await getDocs(query(collection(db, collectionName), where(documentId(), 'in', chunk)))
    snap.forEach((d) => { byId[d.id] = d.data() })
  }
  return byId
}

// Products carry a legacy numeric `id` field (from the pre-Firestore data source)
// that's distinct from their Firestore document id — the whole POS cart/order system
// identifies products by that numeric `id`, but `recipes` docs are keyed by the
// Firestore doc id (`product.docId`), matching how Stock's Recipe Editor saves them.
// Cart items carry both — `productDocId` is what actually looks up the recipe;
// `id` stays for display/existing dedup logic. Orders written before this fix only
// have `id`, so those items are skipped for costing (not blocked from paying).
export async function computeAndDeductOrderStock(items, totalRevenue, orderId) {
  const warnings = []
  const productDocIds = [...new Set(items.map((it) => it.productDocId).filter(Boolean))]

  if (productDocIds.length === 0) {
    return { itemsWithCosts: items, totalCogs: 0, grossProfit: totalRevenue, profitMargin: totalRevenue > 0 ? 100 : 0, warnings }
  }

  const recipesById = await fetchByIds('recipes', productDocIds)

  const deductions = {} // materialId -> total quantity to remove across the whole order
  const itemsWithCosts = items.map((item) => {
    const recipe = item.productDocId ? recipesById[item.productDocId] : null
    if (!recipe || !(recipe.fixedIngredients?.length > 0)) {
      warnings.push(`"${item.name}" no tiene receta — no se calculó costo ni se dedujo stock para este producto.`)
      return { ...item, costPerUnit: null, totalCost: null }
    }

    const ingredientLines = [...recipe.fixedIngredients]
    for (const so of item.selectedOptions || []) {
      if (!so.groupId || !so.optionId) {
        if (so.optionName) warnings.push(`"${item.name}": opción "${so.optionName}" es de un pedido con formato anterior — se ignoró para el costeo.`)
        continue
      }
      const optionData = recipe.optionIngredients?.[so.groupId]?.options?.[so.optionId]
      if (optionData?.ingredients?.length) ingredientLines.push(...optionData.ingredients)
    }

    const costPerUnit = Number(ingredientLines.reduce((sum, ing) => sum + ing.totalCost, 0).toFixed(2))
    const qty = item.qty || 1
    const totalCost = Number((costPerUnit * qty).toFixed(2))

    ingredientLines.forEach((ing) => {
      // quantityInMaterialUnit is the ingredient's quantity already converted into
      // the raw material's own unit (recipe lines can be entered in any unit from
      // the same family, e.g. ml against a material stocked in liters) — that's
      // what actually needs to come off rawMaterials.currentStock. Falls back to
      // the raw quantity for ingredients saved before this field existed.
      const materialQty = ing.quantityInMaterialUnit ?? ing.quantity
      deductions[ing.materialId] = (deductions[ing.materialId] || 0) + materialQty * qty
    })

    return { ...item, costPerUnit, totalCost }
  })

  const totalCogs = Number(itemsWithCosts.reduce((sum, it) => sum + (it.totalCost || 0), 0).toFixed(2))
  const grossProfit = Number((totalRevenue - totalCogs).toFixed(2))
  const profitMargin = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0

  const materialIds = Object.keys(deductions)
  if (materialIds.length > 0) {
    // Read current stock once, only to log an accurate-at-the-time previousStock/newStock
    // on the movement record. The actual deduction below uses increment(), which stays
    // correct even if stock changes concurrently between this read and the write.
    const materialsById = await fetchByIds('rawMaterials', materialIds)

    const batch = writeBatch(db)
    materialIds.forEach((materialId) => {
      const qty = deductions[materialId]
      const material = materialsById[materialId]
      const previousStock = material?.currentStock ?? 0
      const newStock = previousStock - qty

      if (material?.reorderLevel > 0 && newStock <= material.reorderLevel) {
        warnings.push(`"${material.name}" quedó en ${newStock} ${material.unit} — por debajo del nivel de reorden (${material.reorderLevel}).`)
      }
      if (newStock < 0) {
        warnings.push(`"${material?.name || materialId}" quedó en stock negativo (${newStock} ${material?.unit || ''}). Revisa el inventario.`)
      }

      batch.update(doc(db, 'rawMaterials', materialId), {
        currentStock: increment(-qty),
        lastUpdated: serverTimestamp(),
      })
      batch.set(doc(collection(db, 'stockMovements')), {
        type: 'order_deduction',
        materialId,
        quantityChanged: -qty,
        previousStock,
        newStock,
        orderId: orderId || null,
        createdAt: serverTimestamp(),
      })
    })
    await batch.commit()
  }

  if (warnings.length > 0) {
    // No toast/snackbar system exists in this codebase for non-blocking operational
    // warnings — logged for now so nothing is silently lost. Surface in the UI later
    // if these turn out to need staff attention in the moment.
    console.warn('Stock deduction warnings:', warnings)
  }

  return { itemsWithCosts, totalCogs, grossProfit, profitMargin, warnings }
}
