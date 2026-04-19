import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { sections as staticSections } from '../assets/sections'

// Loads menu sections from Firestore. Falls back to local static data when the
// collection is empty so the menu renders without needing any Firestore docs.
export const useSections = () => {
  const [sections, setSections] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true

    const loadSections = async () => {
      setIsLoading(true)
      setError('')
      try {
        const sectionsRef = collection(db, 'sections')
        const snapshot = await getDocs(sectionsRef)

        if (!snapshot.empty) {
          const results = snapshot.docs
            .map((doc) => ({
              id: doc.data()?.id ?? doc.id,
              docId: doc.id,
              ...doc.data(),
            }))
            .filter((s) => s.visible !== false)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          if (isActive) setSections(results)
        } else {
          // Firestore collection is empty — use bundled static data
          if (isActive) setSections(staticSections)
        }
      } catch (error) {
        console.error('Failed to load sections from Firestore:', error)
        // On any error also fall back to static data so the menu still loads
        if (isActive) setSections(staticSections)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    loadSections()
    return () => { isActive = false }
  }, [])

  return { sections, isLoading, error }
}
