import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export const useSettings = () => {
  const [settings, setSettings] = useState(undefined)
  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (cancelled) return
      unsub = onSnapshot(
        doc(db, 'settings', 'general'),
        snap => { if (alive) setSettings(snap.exists() ? snap.data() : null) },
        ()    => { if (alive) setSettings(null) }
      )
    }, 0)
    return () => {
      cancelled = true
      alive = false
      clearTimeout(timer)
      if (unsub) try { unsub() } catch {}
    }
  }, [])
  return { settings, loading: settings === undefined }
}
