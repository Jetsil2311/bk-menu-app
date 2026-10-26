// Firestore access for the POS API (server only — never bundled into the app).
//
// Production (Vercel): FIREBASE_SERVICE_ACCOUNT = the service account JSON
// from Firebase console → Project settings → Service accounts → "Generate new
// private key" (paste the whole JSON, or the same JSON base64-encoded).
// Local test environment: FIRESTORE_EMULATOR_HOST is set → the emulator's demo
// project is used and no credentials are needed.
import admin from 'firebase-admin'

let db = null

const readServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  return JSON.parse(text)
}

export const getDb = () => {
  if (db) return db
  if (!admin.apps.length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-bubblekaapeh' })
    } else {
      const account = readServiceAccount()
      if (!account) {
        const err = new Error('FIREBASE_SERVICE_ACCOUNT is not set on the server')
        err.status = 503
        err.code = 'not_configured'
        throw err
      }
      admin.initializeApp({ credential: admin.credential.cert(account), projectId: account.project_id })
    }
  }
  db = admin.firestore()
  return db
}

export const Timestamp = admin.firestore.Timestamp
export const FieldValue = admin.firestore.FieldValue
export const FieldPath = admin.firestore.FieldPath
