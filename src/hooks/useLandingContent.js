import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { mergeLanding } from '../config/landingContent'

export const landingDocRef = () => doc(db, 'settings', 'landing')

// Live landing page content (Admin → Landing) merged over the defaults, so
// the page renders right away and updates as soon as the owner publishes.
export const useLandingContent = () => {
  const [saved, setSaved] = useState(undefined) // undefined = loading, null = never saved
  useEffect(() => {
    // Same deferred subscribe as useSettings (StrictMode double-mount safe).
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (!alive) return
      unsub = onSnapshot(
        landingDocRef(),
        (snap) => { if (alive) setSaved(snap.exists() ? snap.data() : null) },
        () => { if (alive) setSaved(null) }
      )
    }, 0)
    return () => {
      alive = false
      clearTimeout(timer)
      if (unsub) try { unsub() } catch { /* already closed */ }
    }
  }, [])
  const content = useMemo(() => mergeLanding(saved), [saved])
  return { content, saved, loading: saved === undefined }
}
