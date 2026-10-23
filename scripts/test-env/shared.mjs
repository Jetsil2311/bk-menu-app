// Shared helpers for the local test environment (Firebase emulators).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const TEST_PROJECT_ID = 'demo-bubblekaapeh'
export const PROD_PROJECT_ID = 'bubblekaapeh'
export const SEED_DIR = path.join(ROOT, 'emulator-seed')
export const SNAPSHOT_FILE = path.join(SEED_DIR, 'production.json')
export const DATA_DIR = path.join(ROOT, 'emulator-data')

// Reads KEY=value pairs from .env.emulator (no dependency on dotenv).
export const readEmulatorEnv = () => {
  const file = path.join(ROOT, '.env.emulator')
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

// ── Firestore value <-> JSON ────────────────────────────────────────────────
// Timestamps, GeoPoints, references and bytes don't survive JSON.stringify,
// so they are tagged on the way out and rebuilt on the way in.
export const encodeValue = (v) => {
  if (v === null || v === undefined) return v ?? null
  if (Array.isArray(v)) return v.map(encodeValue)
  if (typeof v === 'object') {
    const ctor = v.constructor?.name
    if (ctor === 'Timestamp' && typeof v.toMillis === 'function') return { __type: 'timestamp', seconds: v.seconds, nanoseconds: v.nanoseconds }
    if (ctor === 'GeoPoint') return { __type: 'geopoint', latitude: v.latitude, longitude: v.longitude }
    if (ctor === 'DocumentReference' && typeof v.path === 'string') return { __type: 'ref', path: v.path }
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __type: 'bytes', base64: Buffer.from(v).toString('base64') }
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = encodeValue(val)
    return out
  }
  return v
}

export const decodeValue = (v, admin, db) => {
  if (v === null || v === undefined) return v ?? null
  if (Array.isArray(v)) return v.map((x) => decodeValue(x, admin, db))
  if (typeof v === 'object') {
    switch (v.__type) {
      case 'timestamp': return new admin.firestore.Timestamp(v.seconds, v.nanoseconds)
      case 'geopoint': return new admin.firestore.GeoPoint(v.latitude, v.longitude)
      case 'ref': return db.doc(v.path)
      case 'bytes': return Buffer.from(v.base64, 'base64')
      default: {
        const out = {}
        for (const [k, val] of Object.entries(v)) out[k] = decodeValue(val, admin, db)
        return out
      }
    }
  }
  return v
}
