// "¿Te gusta Bubble Kaapeh?" — when to invite a customer to leave a Google
// review. Everything is per device (localStorage); nothing is sent anywhere.
//
//   • Only from the customer's 2nd order on this device (they've tried us).
//   • Only once they come back to the menu after sending the order.
//   • "Ahora no" → quiet for 30 days. "Dejar reseña" → never again.
//
// Everyone who qualifies gets the same invitation: Google's review policy
// doesn't allow asking only happy customers ("review gating").

export const MIN_ORDERS = 2
export const SNOOZE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

const STORAGE_KEY = 'bk_review_prompt'
const PENDING_KEY = 'bk_review_pending' // sessionStorage: an order was just sent

export const emptyReviewState = () => ({ orders: 0, lastShown: 0, reviewed: false })

export const withOrder = (state) => ({ ...state, orders: (state.orders || 0) + 1 })

export const shouldInvite = (state, now = Date.now()) =>
  !state.reviewed &&
  (state.orders || 0) >= MIN_ORDERS &&
  now - (state.lastShown || 0) >= SNOOZE_DAYS * DAY_MS

export const withShown = (state, now = Date.now()) => ({ ...state, lastShown: now })

export const withReviewed = (state) => ({ ...state, reviewed: true })

// ── Storage (private mode / blocked storage just means "never invite") ──────

export const readReviewState = () => {
  try {
    return { ...emptyReviewState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  } catch {
    return emptyReviewState()
  }
}

export const writeReviewState = (state) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* private mode */ }
}

// A review button was tapped (landing, menu footer or the card itself):
// don't invite this device again.
export const markReviewed = () => writeReviewState(withReviewed(readReviewState()))

// Called when the customer sends an order to WhatsApp.
export const recordOrderSent = () => {
  writeReviewState(withOrder(readReviewState()))
  try { sessionStorage.setItem(PENDING_KEY, '1') } catch { /* private mode */ }
  window.dispatchEvent(new Event('bk:order-sent'))
}

export const hasPendingOrder = () => {
  try { return sessionStorage.getItem(PENDING_KEY) === '1' } catch { return false }
}

export const clearPendingOrder = () => {
  try { sessionStorage.removeItem(PENDING_KEY) } catch { /* private mode */ }
}
