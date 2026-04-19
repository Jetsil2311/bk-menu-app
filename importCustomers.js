/**
 * importCustomers.js — Mi Cafetería Customer CSV Import
 * =======================================================
 *
 * PREREQUISITES
 *   - firebase-admin is already in package.json (no extra install needed)
 *   - You need a service account key from Firebase Console:
 *     Firebase Console → Project Settings → Service Accounts → Generate new private key
 *     Save it as serviceAccountKey.json in the project root
 *
 * DRY-RUN (parses everything, writes nothing):
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node importCustomers.js --dry-run
 *
 * REAL IMPORT:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node importCustomers.js
 *
 * ALTERNATIVE — inline JSON credentials (useful for CI):
 *   FIREBASE_SERVICE_ACCOUNT='{ "type": "service_account", ... }' node importCustomers.js [--dry-run]
 *
 * FIELD MAPPING (CSV → Firestore)
 *   ID del cliente      → document ID (string)
 *   Nombre del cliente  → name          (string, title-cased)
 *   Número de teléfono  → phone         (string, digits only — POS range-query key)
 *   Balance de puntos   → loyaltyBalance (number, float)
 *   Primera visita      → createdAt     (Timestamp — Customers.jsx "Cliente desde:")
 *                       → firstVisit    (Timestamp — historical reference)
 *   Ultima visita       → lastVisit     (Timestamp — updated by POS after each order)
 *   Total de visitas    → visitCount    (number, integer — app field is "visitCount")
 *   Gasto total         → totalSpend    (number, float — stored for future analytics)
 *   All other columns   → skipped (Email, Dirección, etc. are not read by the app)
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import admin from 'firebase-admin'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ─── Configuration ────────────────────────────────────────────────────────────

const DRY_RUN   = process.argv.includes('--dry-run')
const CSV_FILE  = path.resolve(__dirname, 'customers-2026-04-18.csv')
const BATCH_SIZE = 400   // safely under Firestore's 500-op limit

// ─── Firebase init (deferred — not needed for --dry-run) ─────────────────────

let db, Timestamp, FieldValue

async function initFirebase() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const credJson = process.env.FIREBASE_SERVICE_ACCOUNT

  if (!credPath && !credJson) {
    console.error('❌  Missing credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.')
    process.exit(1)
  }

  let serviceAccount
  if (credJson) {
    try { serviceAccount = JSON.parse(credJson) }
    catch { console.error('❌  FIREBASE_SERVICE_ACCOUNT is not valid JSON.'); process.exit(1) }
  } else {
    const resolved = path.isAbsolute(credPath)
      ? credPath
      : path.resolve(process.cwd(), credPath)
    try {
      serviceAccount = JSON.parse(await fs.readFile(resolved, 'utf-8'))
    } catch {
      console.error(`❌  Could not read service account file at: ${resolved}`)
      process.exit(1)
    }
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  }

  db         = admin.firestore()
  Timestamp  = admin.firestore.Timestamp
  FieldValue = admin.firestore.FieldValue
}

// In dry-run mode we still need Timestamp for date serialization, but not db.
// Use the admin SDK's Timestamp even without a live connection.
if (!DRY_RUN) {
  await initFirebase()
} else {
  // Minimal init: just bring Timestamp + FieldValue into scope for dry-run previews.
  // We never call db, so credentials are not required.
  Timestamp  = { fromDate: (d) => ({ _dryRun: true, toDate: () => d }) }
  FieldValue = { serverTimestamp: () => '<serverTimestamp>' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse "DD/MM/YY HH:MM" → Date. Returns null on any failure.
 * Example: "14/08/25 20:48" → August 14, 2025 at 20:48
 */
function parseDate(raw) {
  const s = (raw || '').trim()
  if (!s) return null
  try {
    const [datePart, timePart = '00:00'] = s.split(' ')
    const parts = datePart.split('/')
    if (parts.length !== 3) return null
    const [day, month, year] = parts
    const [hour = '0', minute = '0'] = (timePart || '').split(':')
    // "25" → 2025, "26" → 2026
    const fullYear = parseInt(year, 10) + 2000
    const d = new Date(
      fullYear,
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
    )
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/** Convert Date → Firestore Timestamp, or null if date is null. */
const toTimestamp = (date) => date ? Timestamp.fromDate(date) : null

/**
 * Convert name to proper Title Case word-by-word.
 * Applied when any word is all-uppercase, all-lowercase, or has internal mixed case.
 */
function toTitleCase(str) {
  return str
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Return true if every word is already in Proper Title Case. */
function isProperTitleCase(name) {
  return name.split(' ').filter(Boolean).every(word =>
    word.length === 0 ||
    (word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase())
  )
}

/** Strip all non-digit characters from a phone number. */
const cleanPhone = (raw) => (raw || '').replace(/\D/g, '')

/**
 * Return true if the name should cause the record to be skipped:
 *   - Empty / whitespace only
 *   - Single dot (".")
 *   - Pure digit string (e.g. "5535157946", "1234567890")
 */
function isJunkName(name) {
  const t = (name || '').trim()
  if (!t || t === '.') return true
  if (/^\d+$/.test(t)) return true
  return false
}

/**
 * Minimal CSV line parser that handles quoted fields containing commas.
 */
function parseCsvLine(line) {
  const result = []
  let cur = ''
  let inQuote = false
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

// ─── Read CSV ─────────────────────────────────────────────────────────────────

let raw
try {
  raw = await fs.readFile(CSV_FILE, 'utf-8')
} catch {
  console.error(`❌  Cannot read CSV file: ${CSV_FILE}`)
  process.exit(1)
}

const lines = raw.split('\n').map(l => l.trimEnd()).filter(Boolean)
const [, ...dataLines] = lines  // drop header row

console.log(`📂  CSV: ${path.basename(CSV_FILE)}`)
console.log(`📊  Total data rows: ${dataLines.length}`)
if (DRY_RUN) {
  console.log('🔍  DRY-RUN mode — nothing will be written to Firestore\n')
}

// ─── Parse + clean + validate ─────────────────────────────────────────────────

let totalSkipped  = 0
let totalAnomalies = 0
const skippedLog  = []   // { lineNum, reason }
const anomalyLog  = []   // { lineNum, type, detail }
const anomalyRows = new Set()  // unique line numbers with any anomaly
const docs        = []   // { docId, docData }

for (let i = 0; i < dataLines.length; i++) {
  const lineNum = i + 2   // 1-indexed + 1 for header
  const line    = dataLines[i]
  let cols

  try {
    cols = parseCsvLine(line)
  } catch (err) {
    console.warn(`⚠️   Row ${lineNum}: parse error — ${err.message}`)
    console.warn(`     Raw: ${line}`)
    totalSkipped++
    skippedLog.push({ lineNum, reason: `CSV parse error: ${err.message}` })
    continue
  }

  // Pad to 16 columns so destructuring is safe
  while (cols.length < 16) cols.push('')

  const [
    csvId,         // 0  ID del cliente → doc ID
    csvName,       // 1  Nombre del cliente → name
    ,              // 2  Email → NOT used by app, skip
    csvPhone,      // 3  Número de teléfono → phone
    ,              // 4  Dirección → skip
    ,              // 5  Ciudad → skip
    ,              // 6  Estado → skip
    ,              // 7  Código postal → skip
    ,              // 8  País → skip
    ,              // 9  Código de cliente → skip
    csvBalance,    // 10 Balance de puntos → loyaltyBalance
    ,              // 11 Nota → skip
    csvFirstVisit, // 12 Primera visita → createdAt + firstVisit
    csvLastVisit,  // 13 Ultima visita → lastVisit
    csvVisits,     // 14 Total de visitas → visitCount
    csvSpend,      // 15 Gasto total → totalSpend
  ] = cols.map(c => c.trim())

  // ── Skip junk names ────────────────────────────────────────────────────────
  if (isJunkName(csvName)) {
    console.warn(`⚠️   Row ${lineNum}: SKIP — junk name: ${JSON.stringify(csvName)}`)
    totalSkipped++
    skippedLog.push({ lineNum, reason: `junk name: ${JSON.stringify(csvName)}` })
    continue
  }

  // ── Skip test records (0 visits AND no dates) ──────────────────────────────
  const visitsRaw = parseInt(csvVisits, 10)
  if ((isNaN(visitsRaw) || visitsRaw === 0) && !csvFirstVisit.trim() && !csvLastVisit.trim()) {
    console.warn(`⚠️   Row ${lineNum}: SKIP — 0 visits + no dates (likely test record): ${csvName}`)
    totalSkipped++
    skippedLog.push({ lineNum, reason: `0 visits and no dates: ${csvName}` })
    continue
  }

  // ── Name normalization ─────────────────────────────────────────────────────
  let name = csvName.trim()
  if (!isProperTitleCase(name)) {
    const normalized = toTitleCase(name)
    console.log(`✏️   Row ${lineNum}: Name normalized "${name}" → "${normalized}"`)
    anomalyLog.push({ lineNum, type: 'name normalized', detail: `"${name}" → "${normalized}"` })
    anomalyRows.add(lineNum)
    name = normalized
  }

  // ── Phone cleaning ─────────────────────────────────────────────────────────
  const phone = cleanPhone(csvPhone)
  if (phone.length > 10) {
    console.warn(`⚠️   Row ${lineNum}: Phone "${phone}" has ${phone.length} digits — potentially malformed, importing anyway`)
    anomalyLog.push({ lineNum, type: 'long phone', detail: `${phone.length} digits: ${phone}` })
    anomalyRows.add(lineNum)
  }

  // ── loyaltyBalance ─────────────────────────────────────────────────────────
  let loyaltyBalance = parseFloat(csvBalance)
  if (isNaN(loyaltyBalance)) {
    console.warn(`⚠️   Row ${lineNum}: loyaltyBalance "${csvBalance}" not a number — defaulting to 0`)
    loyaltyBalance = 0
    anomalyLog.push({ lineNum, type: 'loyaltyBalance default', detail: `raw: "${csvBalance}"` })
    anomalyRows.add(lineNum)
  }

  // ── visitCount ─────────────────────────────────────────────────────────────
  // NOTE: app field is "visitCount", NOT "totalVisits" — verified in POS.jsx and Customers.jsx
  let visitCount = parseInt(csvVisits, 10)
  if (isNaN(visitCount)) {
    console.warn(`⚠️   Row ${lineNum}: visitCount "${csvVisits}" not a number — defaulting to 0`)
    visitCount = 0
    anomalyLog.push({ lineNum, type: 'visitCount default', detail: `raw: "${csvVisits}"` })
    anomalyRows.add(lineNum)
  }

  // ── totalSpend ─────────────────────────────────────────────────────────────
  let totalSpend = parseFloat(csvSpend)
  if (isNaN(totalSpend)) {
    console.warn(`⚠️   Row ${lineNum}: totalSpend "${csvSpend}" not a number — defaulting to 0`)
    totalSpend = 0
    anomalyLog.push({ lineNum, type: 'totalSpend default', detail: `raw: "${csvSpend}"` })
    anomalyRows.add(lineNum)
  }

  // ── Dates ──────────────────────────────────────────────────────────────────
  const firstVisitDate = parseDate(csvFirstVisit)
  const lastVisitDate  = parseDate(csvLastVisit)

  if (csvFirstVisit && !firstVisitDate) {
    console.warn(`⚠️   Row ${lineNum}: Cannot parse firstVisit "${csvFirstVisit}" — storing null`)
    anomalyLog.push({ lineNum, type: 'firstVisit parse fail', detail: `raw: "${csvFirstVisit}"` })
    anomalyRows.add(lineNum)
  }
  if (csvLastVisit && !lastVisitDate) {
    console.warn(`⚠️   Row ${lineNum}: Cannot parse lastVisit "${csvLastVisit}" — storing null`)
    anomalyLog.push({ lineNum, type: 'lastVisit parse fail', detail: `raw: "${csvLastVisit}"` })
    anomalyRows.add(lineNum)
  }

  // ── Build document ─────────────────────────────────────────────────────────
  //
  // Field names are verified against:
  //   POS.jsx:       name, phone, loyaltyBalance, visitCount, lastVisit
  //   Customers.jsx: name, phone, loyaltyBalance, visitCount, createdAt
  //
  const docData = {
    name,                                   // string — display + POS badge
    phone,                                  // string — POS range query: where('phone', '>=', ...)
    loyaltyBalance,                         // number — loyalty balance float
    visitCount,                             // number — "Total de visitas" counter
    createdAt:  toTimestamp(firstVisitDate), // Timestamp — "Cliente desde:" in Customers.jsx
    firstVisit: toTimestamp(firstVisitDate), // Timestamp — historical reference
    lastVisit:  toTimestamp(lastVisitDate),  // Timestamp — updated by POS after orders
    totalSpend,                             // number — stored for future analytics
    updatedAt:  FieldValue.serverTimestamp(), // always set on every write
  }

  const docId = csvId.trim() || `imported-${lineNum}`
  docs.push({ docId, docData, lineNum, name, phone })
}

totalAnomalies = anomalyRows.size

// ─── Dry-run: preview first 5 docs ────────────────────────────────────────────

if (DRY_RUN) {
  console.log('\n══════════ DRY-RUN PREVIEW — first 5 documents ══════════\n')
  docs.slice(0, 5).forEach(({ docId, docData, lineNum }) => {
    console.log(`── Row ${lineNum}  doc ID: customers/${docId}`)
    const printable = {
      ...docData,
      createdAt:  docData.createdAt  ? docData.createdAt.toDate().toISOString()  : null,
      firstVisit: docData.firstVisit ? docData.firstVisit.toDate().toISOString() : null,
      lastVisit:  docData.lastVisit  ? docData.lastVisit.toDate().toISOString()  : null,
      updatedAt:  '<serverTimestamp>',
    }
    console.log(JSON.stringify(printable, null, 2))
    console.log()
  })
}

// ─── Write to Firestore ───────────────────────────────────────────────────────

let totalImported = 0

if (!DRY_RUN && docs.length > 0) {
  console.log(`\n🚀  Writing ${docs.length} documents in batches of ${BATCH_SIZE}…\n`)

  for (let start = 0; start < docs.length; start += BATCH_SIZE) {
    const slice = docs.slice(start, start + BATCH_SIZE)
    const batch = db.batch()
    for (const { docId, docData } of slice) {
      batch.set(
        db.collection('customers').doc(docId),
        docData,
        { merge: true },  // update existing docs without overwriting unrelated fields
      )
    }
    try {
      await batch.commit()
      totalImported += slice.length
      const batchNum   = Math.floor(start / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(docs.length / BATCH_SIZE)
      console.log(`  ✅  Batch ${batchNum}/${totalBatches} — ${slice.length} docs committed`)
    } catch (err) {
      console.error(`  ❌  Batch starting at row ${docs[start].lineNum} failed: ${err.message}`)
      // Continue with next batch rather than aborting
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

const importedDisplay = DRY_RUN ? `${docs.length} (dry-run — not written)` : `${totalImported}`

console.log('\n═══════════════════════ IMPORT SUMMARY ═══════════════════════')
console.log(`  Total rows in CSV:          ${dataLines.length}`)
console.log(`  Imported successfully:      ${importedDisplay}`)
console.log(`  Skipped:                    ${totalSkipped}`)
console.log(`  Records with anomalies:     ${totalAnomalies}`)

if (skippedLog.length > 0) {
  console.log('\n  Skipped records:')
  skippedLog.forEach(r => console.log(`    Row ${String(r.lineNum).padStart(3)}: ${r.reason}`))
}

if (anomalyLog.length > 0) {
  console.log('\n  Anomalies (imported with corrections):')
  anomalyLog.forEach(r => console.log(`    Row ${String(r.lineNum).padStart(3)}: [${r.type}] ${r.detail}`))
}

console.log('══════════════════════════════════════════════════════════════')

if (DRY_RUN) {
  console.log('\n⚠️   DRY-RUN — no data was written. Run without --dry-run to import.')
} else if (totalImported > 0) {
  console.log('\n🎉  Import complete.')
  console.log('    Verify in Firebase Console → Firestore → customers collection.')
  console.log('    POS customer search and Customers admin page will show imported records immediately.')
}
