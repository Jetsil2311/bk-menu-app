// npm run test:pull
//
// Makes a READ-ONLY copy of the real café database into
// emulator-seed/production.json, so `npm run test:reset` can load real
// products, customers, orders, stock… into the local test environment.
//
// This script only ever calls .get() / listCollections() — it never writes,
// updates or deletes anything in production.
//
// Needs a service account key (Firebase Console → Project settings →
// Service accounts → Generate new private key), saved as
// ./serviceAccountKey.json (already git-ignored) or pointed to with
// GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
import fs from 'node:fs'
import path from 'node:path'
import admin from 'firebase-admin'
import { ROOT, PROD_PROJECT_ID, SEED_DIR, SNAPSHOT_FILE, encodeValue } from './shared.mjs'

// Never read from an emulator by accident (and never treat it as production).
delete process.env.FIRESTORE_EMULATOR_HOST
delete process.env.FIREBASE_AUTH_EMULATOR_HOST

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(ROOT, 'serviceAccountKey.json')
if (!fs.existsSync(keyPath)) {
  console.error(`\n✗ No se encontró la llave de servicio en ${keyPath}

  1. Firebase Console → ⚙ Configuración del proyecto → Cuentas de servicio
  2. "Generar nueva clave privada"
  3. Guárdala como serviceAccountKey.json en la carpeta del proyecto
  4. Vuelve a correr: npm run test:pull
`)
  process.exit(1)
}

const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'))
if (key.project_id !== PROD_PROJECT_ID) {
  console.error(`✗ La llave es del proyecto "${key.project_id}", se esperaba "${PROD_PROJECT_ID}".`)
  process.exit(1)
}

admin.initializeApp({ credential: admin.credential.cert(key), projectId: PROD_PROJECT_ID })
const db = admin.firestore()

// Recursively reads a collection, including subcollections.
const readCollection = async (colRef) => {
  const snap = await colRef.get()
  const docs = {}
  for (const d of snap.docs) {
    const subcollections = {}
    for (const sub of await d.ref.listCollections()) {
      subcollections[sub.id] = await readCollection(sub)
    }
    docs[d.id] = { data: encodeValue(d.data()), ...(Object.keys(subcollections).length ? { subcollections } : {}) }
  }
  return docs
}

const main = async () => {
  console.log(`Leyendo ${PROD_PROJECT_ID} (solo lectura)…`)
  const collections = {}
  for (const col of await db.listCollections()) {
    collections[col.id] = await readCollection(col)
    console.log(`  ✓ ${col.id.padEnd(20)} ${Object.keys(collections[col.id]).length} docs`)
  }
  fs.mkdirSync(SEED_DIR, { recursive: true })
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify({ project: PROD_PROJECT_ID, pulledAt: new Date().toISOString(), collections }, null, 1))
  console.log(`\n✓ Copia guardada en ${path.relative(ROOT, SNAPSHOT_FILE)}`)
  console.log('  Contiene datos reales de clientes — no la compartas ni la subas a git (ya está ignorada).')
  console.log('  Ahora corre: npm run test:reset   para cargarla en el entorno de prueba.\n')
}

main().catch((err) => { console.error('✗ Error leyendo producción:', err.message); process.exit(1) })
