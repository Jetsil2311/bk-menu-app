// Sound + system notifications for the admin panel (new web orders, stock
// running out). Everything degrades quietly: no audio before the first tap,
// no system notification without permission, and nothing at all on browsers
// that lack the APIs.

// ── Sound ───────────────────────────────────────────────────────────────────
// Browsers only allow audio after the user has interacted with the page, so
// the AudioContext is created/resumed on the first tap and reused after.
let audioCtx = null

const getAudio = () => {
  if (audioCtx) return audioCtx
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!Ctx) return null
  try { audioCtx = new Ctx() } catch { audioCtx = null }
  return audioCtx
}

export const unlockAlertSound = () => {
  const ctx = getAudio()
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
}

// Two-tone "ding-dong" for orders (repeated so it's heard over a busy bar),
// a single softer tone for stock warnings. Generated, so no audio file.
const TONES = {
  order: [[880, 0], [660, 0.18], [880, 0.6], [660, 0.78]],
  stock: [[523, 0], [392, 0.2]],
}

export const playAlertSound = (kind = 'order') => {
  const ctx = getAudio()
  if (!ctx || ctx.state !== 'running') return
  const start = ctx.currentTime + 0.02
  for (const [freq, at] of TONES[kind] || TONES.order) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start + at)
    gain.gain.exponentialRampToValueAtTime(0.35, start + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.45)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start + at)
    osc.stop(start + at + 0.5)
  }
}

// ── System notifications ────────────────────────────────────────────────────
export const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window

export const notificationPermission = () =>
  notificationsSupported() ? window.Notification.permission : 'unsupported'

// Must be called from a tap (Safari ignores it otherwise).
export const requestNotificationPermission = async () => {
  if (!notificationsSupported()) return 'unsupported'
  try {
    return await window.Notification.requestPermission()
  } catch {
    return window.Notification.permission
  }
}

// Shows an OS-level notification (visible even when the panel is in another
// tab or minimized). `tag` replaces an older notification about the same thing
// instead of stacking duplicates. Clicking it focuses the panel and runs onClick.
export const showSystemNotification = ({ title, body, tag, onClick, requireInteraction = false }) => {
  if (notificationPermission() !== 'granted') return null
  try {
    const n = new window.Notification(title, {
      body, tag, requireInteraction, icon: '/bklogo.svg', renotify: Boolean(tag),
    })
    n.onclick = () => {
      window.focus()
      onClick?.()
      n.close()
    }
    return n
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
    return null
  }
}
