// Checks the POS API key sent by the calling app (Tally).
//   Authorization: Bearer bkpos_…   or   X-API-Key: bkpos_…
// Keys are looked up by their SHA-256 hash (see src/utils/apiKeys.js); a
// revoked key or one without the needed scope is refused.
import { API_KEYS_COLLECTION, hashApiKey, looksLikeApiKey } from '../../src/utils/apiKeys.js'
import { FieldValue } from './firebaseAdmin.js'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const readKey = (headers = {}) => {
  const auth = headers.authorization || headers.Authorization || ''
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]
  return (bearer || headers['x-api-key'] || headers['X-API-Key'] || '').trim()
}

export const authenticate = async (db, headers, scope) => {
  const key = readKey(headers)
  if (!key) throw new ApiError(401, 'missing_key', 'Send your POS API key as "Authorization: Bearer bkpos_…"')
  if (!looksLikeApiKey(key)) throw new ApiError(401, 'invalid_key', 'That is not a valid POS API key')

  const ref = db.collection(API_KEYS_COLLECTION).doc(await hashApiKey(key))
  const snap = await ref.get()
  if (!snap.exists || snap.data().revokedAt) throw new ApiError(401, 'invalid_key', 'This key does not exist or was revoked')
  const data = snap.data()
  if (scope && !(data.scopes || []).includes(scope)) throw new ApiError(403, 'insufficient_scope', `This key can't read ${scope}`)

  // Shown in Ajustes → Conexiones as "último uso". Not worth failing a read over.
  ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {})
  return { id: snap.id, name: data.name, scopes: data.scopes || [] }
}
