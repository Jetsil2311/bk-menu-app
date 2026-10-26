// Sample sales for the LOCAL emulator, so Finanzas / Inicio / Métricas and the
// stock alerts have realistic data to check against. Numbers are fixed (no
// randomness) so the expected totals can be verified by hand:
//
//   every day of the last 21 days except Sundays:
//     2 × Milky ($65, recipe cost $14.70)  → paid, cost recorded at sale
//     1 × Frappe ($65, recipe cost $16.90) → paid, imported from the web menu
//                                           without productDocId (cost estimated)
//     1 × Heart-Cakes ($40, NO recipe)     → paid, cost unknown
//   plus, on a few days, a cancelled, a refunded and a still-in-kitchen order
//   (none of them are sales).
//   Fixed expenses: Renta $6,000/month + Luz $900/month.
//   Two materials start at/below their warning level (stock alerts).
//
// Used by seed.mjs (only when there are no orders yet) and runnable alone:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/test-env/sample-sales.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

const MILKY = { productDocId: 'product-0', id: '0', name: 'Milky', price: 65 }
const FRAPPE = { productDocId: 'product-1', id: '1', name: 'Frappe', price: 65 }
const CAKES = { productDocId: 'product-10', id: '10', name: 'Heart-Cakes 15pz', price: 40 }

const line = (materialId, materialName, quantity, unit, quantityInMaterialUnit, totalCost) =>
  ({ materialId, materialName, quantity, unit, quantityInMaterialUnit, totalCost })

// Milky: vaso 2.5 + tapa 1.2 + popote 0.8 + leche 250 ml (6.5) + tapioca 30 g (3.6) + hielo 0.1
const MILKY_LINES = [
  line('vaso-16oz', 'Vaso 16 oz', 1, 'units', 1, 2.5),
  line('tapa-domo', 'Tapa domo', 1, 'units', 1, 1.2),
  line('popote-boba', 'Popote para boba', 1, 'units', 1, 0.8),
  line('leche-entera', 'Leche entera', 250, 'ml', 0.25, 6.5),
  line('tapioca', 'Perlas de tapioca', 30, 'grams', 0.03, 3.6),
  line('hielo', 'Hielo', 20, 'grams', 0.02, 0.1),
]
// Frappe: vaso + tapa + leche 200 ml (5.2) + café 18 g (6.84) + hielo 0.36 + popote
const FRAPPE_LINES = [
  line('vaso-16oz', 'Vaso 16 oz', 1, 'units', 1, 2.5),
  line('tapa-domo', 'Tapa domo', 1, 'units', 1, 1.2),
  line('popote-boba', 'Popote para boba', 1, 'units', 1, 0.8),
  line('leche-entera', 'Leche entera', 200, 'ml', 0.2, 5.2),
  line('cafe-grano', 'Café en grano', 18, 'grams', 0.018, 6.84),
  line('hielo', 'Hielo', 60, 'grams', 0.06, 0.36),
]
const sum = (lines) => Number(lines.reduce((s, l) => s + l.totalCost, 0).toFixed(2))
export const MILKY_COST = sum(MILKY_LINES) // 14.70
export const FRAPPE_COST = sum(FRAPPE_LINES) // 16.90

const item = (p, qty, totalCost) => ({
  id: p.id, productDocId: p.productDocId, name: p.name, price: p.price, qty,
  imageUrl: null, itemNote: null, cartItemId: null, stationTags: [],
  selectedOptions: [], selectedToppings: [],
  ...(totalCost === undefined ? {} : { totalCost, costPerUnit: totalCost == null ? null : totalCost / qty }),
})

export const addSampleSales = async (db, admin, { now = new Date() } = {}) => {
  const Ts = admin.firestore.Timestamp
  const batch = db.batch()

  const materials = JSON.parse(fs.readFileSync(path.join(HERE, 'raw-materials-sample.json'), 'utf8'))
  for (const [id, m] of Object.entries(materials)) {
    const low = id === 'tapioca' ? { currentStock: 0.8 } : id === 'leche-entera' ? { currentStock: 3 } : {}
    batch.set(db.collection('rawMaterials').doc(id), { ...m, ...low, supplier: '', notes: 'Muestra del entorno de prueba' }, { merge: true })
  }
  batch.set(db.collection('recipes').doc(MILKY.productDocId), {
    productId: MILKY.productDocId, productName: MILKY.name, fixedIngredients: MILKY_LINES, optionIngredients: {},
  })
  batch.set(db.collection('recipes').doc(FRAPPE.productDocId), {
    productId: FRAPPE.productDocId, productName: FRAPPE.name, fixedIngredients: FRAPPE_LINES, optionIngredients: {},
  })
  batch.set(db.collection('expenses').doc('sample-renta'), { name: 'Renta', amount: 6000, period: 'monthly', dueDay: 1 })
  batch.set(db.collection('expenses').doc('sample-luz'), { name: 'Luz', amount: 900, period: 'monthly', dueDay: 15 })

  let n = 0
  for (let back = 20; back >= 0; back--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, 13, 0)
    if (day.getDay() === 0) continue // closed on Sundays
    const at = (h) => Ts.fromDate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 15))
    const paid = (id, items, h, extra = {}) => {
      const total = items.reduce((s, it) => s + it.price * it.qty, 0)
      const totalCogs = Number(items.reduce((s, it) => s + (it.totalCost || 0), 0).toFixed(2))
      batch.set(db.collection('orders').doc(id), {
        orderId: id.toUpperCase(), items, total, status: 'Pagado', source: 'pos',
        paymentMethods: { cash: total, card: 0, loyalty: 0 },
        totalCogs, grossProfit: total - totalCogs, profitMargin: 0,
        createdAt: at(h), completedAt: at(h), paidAt: at(h), updatedAt: at(h), ...extra,
      })
      n++
    }
    const key = `sample-${back}`
    paid(`${key}-a`, [item(MILKY, 2, MILKY_COST * 2)], 10)
    // Imported from the web menu before the fix: no productDocId, no cost.
    paid(`${key}-b`, [{ ...item(FRAPPE, 1), productDocId: null }], 12, { source: 'whatsapp', totalCogs: 0 })
    paid(`${key}-c`, [item(CAKES, 1, null)], 17)
    if (back % 5 === 0) {
      batch.set(db.collection('orders').doc(`${key}-x`), { orderId: `${key}-x`, items: [item(MILKY, 3)], total: 195, status: 'Cancelado', source: 'pos', createdAt: at(15) })
      batch.set(db.collection('orders').doc(`${key}-r`), { orderId: `${key}-r`, items: [item(MILKY, 1, MILKY_COST)], total: 65, status: 'Reembolsado', source: 'pos', createdAt: at(16), completedAt: at(16) })
    }
  }
  await batch.commit()
  return n
}

// Standalone run (emulator only).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('✗ Solo corre contra el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/test-env/sample-sales.mjs')
    process.exit(1)
  }
  const { default: admin } = await import('firebase-admin')
  const { TEST_PROJECT_ID } = await import('./shared.mjs')
  admin.initializeApp({ projectId: TEST_PROJECT_ID })
  const count = await addSampleSales(admin.firestore(), admin)
  console.log(`✓ ${count} ventas de muestra agregadas al emulador`)
  process.exit(0)
}
