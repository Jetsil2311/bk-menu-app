// POS API keys — let an outside app (Tally, the owner's finance app) read the
// café's business data through /api/v1 (see docs/POS_API.md), the same way
// "connect your account" works elsewhere: the owner creates a key in
// Ajustes → Conexiones, pastes it into the other app once, and can revoke it
// at any time.
//
// Only a SHA-256 hash of each key is stored, as the document id:
//   api_keys/{sha256(key)} = {
//     name, prefix ('bkpos_…' first chars, to recognise it), scopes,
//     createdAt, createdBy, lastUsedAt, revokedAt
//   }
// The plain key is shown once, right after it's created.
// Works in the browser and in Node 18+ (both have Web Crypto).

export const API_KEYS_COLLECTION = 'api_keys'
export const KEY_PREFIX = 'bkpos_'

// What a key may read. Only one scope exists today; kept as a list so keys
// can later be limited (e.g. sales only) without changing their format.
export const SCOPES = {
  financeRead: 'finance:read',
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// 40 random characters (≈238 bits). Rejection sampling keeps it uniform.
export const generateApiKey = (length = 40) => {
  let out = ''
  while (out.length < length) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length * 2))
    for (const b of bytes) {
      if (b < 248 && out.length < length) out += ALPHABET[b % ALPHABET.length]
    }
  }
  return KEY_PREFIX + out
}

export const hashApiKey = async (key) => {
  const data = new TextEncoder().encode(String(key))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// What the list shows so the owner can tell keys apart: "bkpos_AbC4…"
export const keyPreview = (key) => `${String(key).slice(0, KEY_PREFIX.length + 4)}…`

export const looksLikeApiKey = (key) =>
  typeof key === 'string' && key.startsWith(KEY_PREFIX) && /^[A-Za-z0-9]{32,64}$/.test(key.slice(KEY_PREFIX.length))
