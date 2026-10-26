/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { isStaleWhatsAppSnapshot } from '../utils/orderCleanup'

const CLOSED = ['pagado', 'entregado', 'reembolsado', 'cancelado']

const WhatsAppOrdersContext = createContext()

// One shared onSnapshot on unreviewed orders (only WhatsApp snapshots carry
// `reviewed`), client-filtered to the ones still waiting for a cashier.
// Single-field equality, so no composite index needed. (It used to read the
// OLDEST 60 orders, which only worked while the menu capped `orders` at 50.)
export const WhatsAppOrdersProvider = ({ children }) => {
  const [pending, setPending] = useState([])

  useEffect(() => {
    let alive = true
    let unsub = null
    const timer = setTimeout(() => {
      if (!alive) return
      const q = query(collection(db, 'orders'), where('reviewed', '==', false))
      unsub = onSnapshot(
        q,
        (snap) => {
          if (!alive) return
          const orders = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((o) => o.source === 'whatsapp' && !o.discarded && !CLOSED.includes(String(o.status || '').toLowerCase()))
            .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
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

  // Once per admin session: remove WhatsApp snapshots nobody acted on (or
  // that were discarded) after a few days. Paid or worked-on orders are never
  // touched — see utils/orderCleanup.js.
  useEffect(() => {
    const orders = collection(db, 'orders')
    Promise.all([
      getDocs(query(orders, where('reviewed', '==', false))),
      getDocs(query(orders, where('discarded', '==', true))),
    ]).then(async (snaps) => {
      const now = new Date()
      const stale = new Map()
      for (const snap of snaps) {
        for (const d of snap.docs) if (isStaleWhatsAppSnapshot(d.data(), now)) stale.set(d.id, d.ref)
      }
      const refs = [...stale.values()]
      for (let i = 0; i < refs.length; i += 400) {
        const batch = writeBatch(db)
        refs.slice(i, i + 400).forEach((ref) => batch.delete(ref))
        await batch.commit()
      }
    }).catch((error) => console.error('WhatsApp snapshot cleanup failed:', error))
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
