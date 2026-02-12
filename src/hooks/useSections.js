import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

// Loads menu sections from Firestore with loading/error state.
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
        const results = snapshot.docs
          .map((doc) => ({
            id: doc.data()?.id ?? doc.id,
            docId: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        if (isActive) {
          setSections(results)
        }
      } catch (error) {
        console.error('Failed to load sections from Firestore:', error)
        if (isActive) {
          setError('No se pudieron cargar las secciones.')
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadSections()

    return () => {
      isActive = false
    }
  }, [])

  return { sections, isLoading, error }
}
