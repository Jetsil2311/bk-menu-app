import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import admin from 'firebase-admin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
const collectionName = process.env.FIRESTORE_COLLECTION ?? 'products'
const skipExisting = process.env.SKIP_EXISTING !== 'false'

if (!serviceAccountPath && !serviceAccountJson) {
  console.error(
    'Missing credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.'
  )
  process.exit(1)
}

let serviceAccount
if (serviceAccountJson) {
  try {
    serviceAccount = JSON.parse(serviceAccountJson)
  } catch (error) {
    console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.')
    process.exit(1)
  }
} else {
  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath)
  const fileContents = await fs.readFile(resolvedPath, 'utf-8')
  serviceAccount = JSON.parse(fileContents)
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

const productsModuleUrl = pathToFileURL(
  path.resolve(__dirname, '../src/assets/products.js')
).href
const { products } = await import(productsModuleUrl)

if (!Array.isArray(products)) {
  console.error('products.js did not export an array named products.')
  process.exit(1)
}

const normalizeForId = (value) =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

let createdCount = 0
let skippedCount = 0

for (const product of products) {
  const name = product?.name ?? ''
  const section = product?.section ?? ''
  const baseId = `${normalizeForId(section)}-${normalizeForId(name)}`
  const docId = baseId || `product-${product?.id ?? Date.now()}`

  const docRef = db.collection(collectionName).doc(docId)
  const docSnap = await docRef.get()

  if (docSnap.exists && skipExisting) {
    skippedCount += 1
    continue
  }

  const payload = {
    id: product?.id ?? null,
    name: name,
    section: section,
    desc: product?.desc ?? '',
    long_desc: product?.long_desc ?? '',
    price: Number(product?.price ?? 0),
    flavors: Array.isArray(product?.flavors) ? product.flavors : [],
    image: product?.image ?? '',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  if (!docSnap.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp()
  }

  await docRef.set(payload, { merge: true })
  createdCount += 1
}

console.log(
  `Import finished. Upserted ${createdCount} products, skipped ${skippedCount}.`
)
