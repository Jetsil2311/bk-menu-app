import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'

// Loads the currently active promotion (if any).
export const usePromotion = () => {
  const [promotion, setPromotion] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true

    const loadPromotion = async () => {
      setIsLoading(true)
      setError('')
      try {
        const promosRef = collection(db, 'promotions')
        const promosQuery = query(promosRef, where('isActive', '==', true))
        const snapshot = await getDocs(promosQuery)
        const activePromo = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .find(Boolean)

        if (isActive) {
          setPromotion(activePromo ?? null)
        }
      } catch (error) {
        if (isActive) {
          setError('No se pudo cargar la promoción activa.')
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadPromotion()

    return () => {
      isActive = false
    }
  }, [])

  return { promotion, isLoading, error }
}
