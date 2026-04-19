import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

// Live listener for settings/general.
// settings === undefined : still loading (no snapshot received)
// settings === null      : document does not exist
// settings === object    : document data
export const useSettings = () => {
  const [settings, setSettings] = useState(undefined)

  useEffect(() => {
    const ref = doc(db, 'settings', 'general')
    const unsub = onSnapshot(
      ref,
      (snap) => setSettings(snap.exists() ? snap.data() : null),
      () => setSettings(null)
    )
    return unsub
  }, [])

  return { settings, loading: settings === undefined }
}
