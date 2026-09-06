/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

const WhatsAppOrdersContext = createContext()

// One shared onSnapshot on recent orders, client-filtered to pending
// WhatsApp snapshots (source:'whatsapp', not yet reviewed by a cashier).
// No composite index needed — matches the rest of this codebase's
// client-side-filter convention.
export const WhatsAppOrdersProvider = ({ children }) => {
  const [pending, setPending] = useState([])

  useEffect(() => {
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (!alive) return
      const q = query(collection(db, 'orders'), orderBy('createdAt'), limit(60))
      unsub = onSnapshot(
        q,
        (snap) => {
          if (!alive) return
          const orders = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((o) => o.source === 'whatsapp' && !o.reviewed)
          setPending(orders)
        },
        (error) => {
          console.error('Error listening to WhatsApp orders:', error)
          if (alive) setPending([])
        }
      )
    }, 0)
    return () => {
      alive = false
      clearTimeout(timer)
      if (unsub) try { unsub() } catch {}
    }
  }, [])

  return (
    <WhatsAppOrdersContext.Provider value={{ pending, pendingCount: pending.length }}>
      {children}
    </WhatsAppOrdersContext.Provider>
  )
}

export const useWhatsAppOrders = () => {
  const context = useContext(WhatsAppOrdersContext)
  if (!context) {
    throw new Error('useWhatsAppOrders must be used within a WhatsAppOrdersProvider')
  }
  return context
}
