import { useState, useEffect } from 'react'
import { collection, query, addDoc, serverTimestamp, updateDoc, doc, writeBatch, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { Tag, Plus, ToggleLeft, ToggleRight, CheckCircle2, AlertCircle } from 'lucide-react'

export const Promos = () => {
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let alive = true
    let unsubscribe = null
    const timer = setTimeout(() => {
      if (cancelled) return
      const q = query(collection(db, 'promotions'))
      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!alive) return
        const promosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0))
        setPromos(promosData)
        setLoading(false)
      })
    }, 0)
    return () => {
      cancelled = true
      alive = false
      clearTimeout(timer)
      if (unsubscribe) try { unsubscribe() } catch {}
    }
  }, [])

  const handleCreatePromotion = async (e) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      // Deactivate all others first (as per existing logic in Admin.jsx)
      const activePromos = promos.filter(p => p.isActive)
      if (activePromos.length > 0) {
        const batch = writeBatch(db)
        activePromos.forEach(p => {
          batch.update(doc(db, 'promotions', p.id), { isActive: false })
        })
        await batch.commit()
      }

      await addDoc(collection(db, 'promotions'), {
        title: title.trim(),
        message: message.trim(),
        isActive: true,
        createdAt: serverTimestamp(),
      })

      setTitle('')
      setMessage('')
      setSuccess('Promoción activada correctamente.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('No se pudo activar la promoción.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const togglePromo = async (promoId, currentStatus) => {
    try {
      // If we are activating, deactivate others
      if (!currentStatus) {
        const batch = writeBatch(db)
        promos.filter(p => p.isActive).forEach(p => {
          batch.update(doc(db, 'promotions', p.id), { isActive: false })
        })
        await batch.commit()
      }
      
      await updateDoc(doc(db, 'promotions', promoId), { isActive: !currentStatus })
    } catch (err) {
      console.error('Error toggling promo:', err)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="bg-main-900/30 border border-white/5 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-2xl bg-main-500/10 flex items-center justify-center text-main-400">
              <Plus size={24} />
            </div>
            <h3 className="text-xl font-semibold text-light-100">Nueva Promoción</h3>
          </div>

          <form onSubmit={handleCreatePromotion} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-light-200/60">Título de la promoción</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: 2x1 en Frappés"
                className="w-full rounded-2xl border border-white/10 bg-main-900/50 px-4 py-3 text-light-100 outline-none transition focus:border-main-500/50"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-light-200/60">Mensaje adicional (opcional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ej: Válido solo de 2pm a 5pm"
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-main-900/50 px-4 py-3 text-light-100 outline-none transition focus:border-main-500/50 resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                <CheckCircle2 size={16} />
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-main-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-main-400 disabled:opacity-50 shadow-lg shadow-main-500/10"
            >
              {isSubmitting ? 'Guardando...' : 'Activar Promoción'}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-light-100 flex items-center gap-2">
            <Tag size={18} className="text-main-400" />
            Historial de Promociones
          </h3>

          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-light-200/20 py-10">Cargando...</p>
            ) : promos.length === 0 ? (
              <div className="bg-main-900/10 border border-white/5 rounded-3xl p-10 text-center">
                <p className="text-light-200/30 italic">No hay promociones registradas.</p>
              </div>
            ) : promos.map((promo) => (
              <div 
                key={promo.id} 
                className={`bg-main-900/30 border border-white/5 rounded-3xl p-5 flex items-center justify-between transition-all ${promo.isActive ? 'border-main-500/30 bg-main-500/5' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${promo.isActive ? 'bg-main-500/20 text-main-400' : 'bg-white/5 text-light-200/20'}`}>
                    <Tag size={20} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${promo.isActive ? 'text-light-100' : 'text-light-200/40'}`}>
                      {promo.title}
                    </h4>
                    {promo.message && <p className="text-[10px] text-light-200/40 mt-0.5">{promo.message}</p>}
                    <p className="text-[9px] text-light-200/20 mt-1 uppercase tracking-tighter">
                      {promo.createdAt?.toDate().toLocaleDateString('es-MX')}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => togglePromo(promo.id, promo.isActive)}
                  className={`transition-colors ${promo.isActive ? 'text-main-400' : 'text-light-200/20'}`}
                >
                  {promo.isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
