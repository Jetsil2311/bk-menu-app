import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

// Live list of the café's recurring fixed expenses (Finanzas → Gastos fijos).
export const useExpenses = () => {
  const [expenses, setExpenses] = useState([])
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'expenses'),
      (snap) => setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setExpenses([])
    )
    return () => unsub()
  }, [])
  return expenses
}
