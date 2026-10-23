import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { normalizeBuilderConfig } from '../utils/drinkBuilder'

// Live "Arma tu bebida" config from settings/drinkBuilder (see
// utils/drinkBuilder.js for the shape). `config` is null while the café
// hasn't set the builder up — the menu then simply doesn't show it.
export const useDrinkBuilder = () => {
  const [config, setConfig] = useState(undefined)
  useEffect(() => {
    let alive = true
    const unsub = onSnapshot(
      doc(db, 'settings', 'drinkBuilder'),
      (snap) => { if (alive) setConfig(snap.exists() ? normalizeBuilderConfig(snap.data()) : null) },
      () => { if (alive) setConfig(null) }
    )
    return () => {
      alive = false
      unsub()
    }
  }, [])
  return { config: config ?? null, loading: config === undefined }
}
