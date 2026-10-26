// Fills the LOCAL Firebase emulators with test data. Run through
// `npm run test:reset` (which wraps it in `firebase emulators:exec`).
//
// Data source:
//   • emulator-seed/production.json if it exists (made by `npm run test:pull`)
//   • otherwise a demo menu built from src/assets/sections.js + products.js
//   • `--demo` forces the demo menu even if a production copy exists
//
// Also creates the test login from .env.emulator in the Auth emulator.
import fs from 'node:fs'
import path from 'node:path'
import admin from 'firebase-admin'
import { ROOT, TEST_PROJECT_ID, SNAPSHOT_FILE, readEmulatorEnv, decodeValue } from './shared.mjs'
import { addSampleSales } from './sample-sales.mjs'

// ── Safety: only ever write to the emulators ───────────────────────────────
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('✗ Este script solo corre contra los emuladores locales. Usa: npm run test:reset')
  process.exit(1)
}

admin.initializeApp({ projectId: TEST_PROJECT_ID })
const db = admin.firestore()
const env = readEmulatorEnv()
const forceDemo = process.argv.includes('--demo')

const writeDocs = async (colPath, docs) => {
  const entries = Object.entries(docs)
  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch()
    for (const [id, { data }] of entries.slice(i, i + 400)) {
      batch.set(db.collection(colPath).doc(id), decodeValue(data, admin, db))
    }
    await batch.commit()
  }
  for (const [id, { subcollections }] of entries) {
    for (const [sub, subDocs] of Object.entries(subcollections || {})) {
      await writeDocs(`${colPath}/${id}/${sub}`, subDocs)
    }
  }
  return entries.length
}

// Demo menu from the repo's original static data (no real customer data).
const buildDemoCollections = async () => {
  const { sections } = await import(path.join(ROOT, 'src/assets/sections.js'))
  const { products } = await import(path.join(ROOT, 'src/assets/products.js'))
  const now = { __type: 'timestamp', seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }

  const sectionDocs = {}
  sections.forEach((s, i) => {
    sectionDocs[`section-${s.id}`] = {
      data: { id: s.id, name: s.name, desc: s.desc, category: s.category.toLowerCase(), order: i, image: '', visible: true, createdAt: now },
    }
  })

  const toppingDocs = {
    'topping-tapioca': { data: { name: 'Tapioca extra', price: 10, isActive: true, description: 'Perlas de tapioca extra.' } },
    'topping-cloud': { data: { name: 'Cloud Top', price: 15, isActive: true, description: 'Espuma cremosa encima de tu bebida.' } },
  }

  const productDocs = {}
  products.forEach((p) => {
    const flavors = Array.isArray(p.flavors) ? p.flavors : []
    const isDrink = /bebida/i.test(p.section)
    productDocs[`product-${p.id}`] = {
      data: {
        id: p.id,
        name: p.name,
        section: p.section,
        desc: p.desc || '',
        long_desc: p.long_desc || '',
        price: p.price,
        image: p.image || '',
        flavors: [],
        isActive: true,
        toppingIds: isDrink ? ['topping-tapioca', 'topping-cloud'] : [],
        stationTags: [],
        optionGroups: flavors.length
          ? [{
            id: `group-sabor-${p.id}`,
            name: 'Sabor',
            type: 'single',
            required: true,
            options: flavors.map((f, i) => ({ id: `opt-${p.id}-${i}`, name: f, priceModifier: 0 })),
          }]
          : [],
        createdAt: now,
      },
    }
  })

  return {
    sections: sectionDocs,
    products: productDocs,
    toppings: toppingDocs,
    settings: { general: { data: { authorizedEmails: [] } } },
  }
}

// Sample "Arma tu bebida" setup so the builder (and its stock deduction) can
// be tried locally — the real one is made from the admin panel. Each piece is
// only added when the data being loaded doesn't already have it.
const readSample = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/test-env', file), 'utf8'))

const addDrinkBuilderSamples = async (collections) => {
  collections.settings = collections.settings || {}
  if (!collections.settings.drinkBuilder) {
    collections.settings.drinkBuilder = { data: readSample('drink-builder-sample.json') }
  }
  if (!collections.rawMaterials || !Object.keys(collections.rawMaterials).length) {
    collections.rawMaterials = Object.fromEntries(
      Object.entries(readSample('raw-materials-sample.json')).map(([id, m]) => [id, { data: { ...m, supplier: '', notes: 'Muestra del entorno de prueba' } }])
    )
  }
  collections.recipes = collections.recipes || {}
  const { DRINK_RECIPE_ID, draftFromDocs, recipeFromDraft } = await import(path.join(ROOT, 'src/utils/drinkBuilderAdmin.js'))
  if (!collections.recipes[DRINK_RECIPE_ID]) {
    const materials = Object.entries(collections.rawMaterials).map(([docId, { data }]) => ({ docId, ...data }))
    const config = collections.settings.drinkBuilder.data
    const draft = draftFromDocs(config, readSample('drink-builder-recipe-sample.json'))
    collections.recipes[DRINK_RECIPE_ID] = { data: recipeFromDraft(draft, materials) }
  }
}

const main = async () => {
  const useSnapshot = !forceDemo && fs.existsSync(SNAPSHOT_FILE)
  let collections
  if (useSnapshot) {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'))
    collections = snap.collections
    console.log(`Cargando copia de producción del ${snap.pulledAt}…`)
  } else {
    collections = await buildDemoCollections()
    console.log('Cargando menú de demostración (no hay copia de producción; usa npm run test:pull para traerla)…')
  }

  // Test-environment adjustments to settings/general:
  //  • no real WhatsApp number (test orders must not go to the café)
  //  • if an access allowlist exists, include the test login
  const general = collections.settings?.general?.data
  if (general) {
    delete general.orderNotificationPhone
    if (Array.isArray(general.authorizedEmails) && general.authorizedEmails.length && env.VITE_TEST_LOGIN_EMAIL) {
      general.authorizedEmails = [...new Set([...general.authorizedEmails, env.VITE_TEST_LOGIN_EMAIL.toLowerCase()])]
    }
  }

  await addDrinkBuilderSamples(collections)

  for (const [name, docs] of Object.entries(collections)) {
    const n = await writeDocs(name, docs)
    console.log(`  ✓ ${name.padEnd(20)} ${n} docs`)
  }

  // Demo menu only: product ids in sample-sales.mjs match the demo catalog.
  if (!useSnapshot && !Object.keys(collections.orders || {}).length) {
    const n = await addSampleSales(db, admin)
    console.log(`  ✓ ventas de muestra       ${n} pedidos pagados (para revisar Finanzas)`)
  }

  if (env.VITE_TEST_LOGIN_EMAIL && env.VITE_TEST_LOGIN_PASSWORD) {
    try {
      await admin.auth().createUser({
        email: env.VITE_TEST_LOGIN_EMAIL,
        password: env.VITE_TEST_LOGIN_PASSWORD,
        displayName: 'Usuario de prueba',
      })
    } catch (err) {
      if (err.code !== 'auth/email-already-exists') throw err
    }
    console.log(`  ✓ usuario de prueba   ${env.VITE_TEST_LOGIN_EMAIL} (contraseña en .env.emulator)`)
  }

  console.log('\n✓ Entorno de prueba listo. Corre: npm run dev:test\n')
}

main().catch((err) => { console.error('✗ Error sembrando el emulador:', err); process.exit(1) })
