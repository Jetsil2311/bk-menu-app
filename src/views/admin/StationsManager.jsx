/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useStationContext } from '../../context/StationContext'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { NAV_ITEMS, SIDEBAR_ORDER } from '../../config/adminNav'
import { ROLE_LABELS, ROLE_ICONS } from '../../utils/stations'
import {
  Plus, Pencil, Trash2, X, Eye, EyeOff, ChefHat, AlertCircle,
} from 'lucide-react'

const inputCls =
  'w-full rounded-xl border border-white/10 bg-main-900/60 px-3 py-2.5 text-sm text-light-100 placeholder-light-200/30 outline-none transition focus:border-main-500/50 focus:ring-1 focus:ring-main-500/20'
const labelCls = 'block text-xs font-medium text-light-200/60 mb-1.5'

// Slide-over drawer wrapper — mirrors MenuEditor.jsx's own (non-exported)
// Drawer component exactly, since it can't be imported from there.
const Drawer = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-lg flex-col bg-[#1c0a04] border-l border-white/10 shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#1c0a04] z-10">
          <h2 className="text-base font-semibold text-light-100">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-light-200/50 hover:text-light-100 hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 px-6 py-5">{children}</div>
      </div>
    </>
  )
}

const emptyStation = () => ({
  name: '', pin: '', role: 'cajero', productTags: [], disabledRoutes: [], isCore: false,
})

const StationDrawer = ({ isOpen, onClose, title, station, onChange, onSave, isSubmitting, error, isCore, tagSuggestions }) => {
  const [showPin, setShowPin] = useState(false)
  const [tagDraft, setTagDraft] = useState('')

  const addTag = () => {
    const value = tagDraft.trim()
    if (!value || (station.productTags || []).includes(value)) { setTagDraft(''); return }
    onChange('productTags', [...(station.productTags || []), value])
    setTagDraft('')
  }

  const removeTag = (tag) => {
    onChange('productTags', (station.productTags || []).filter((t) => t !== tag))
  }

  const toggleRoute = (routeKey) => {
    const current = station.disabledRoutes || []
    onChange('disabledRoutes', current.includes(routeKey)
      ? current.filter((r) => r !== routeKey)
      : [...current, routeKey])
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Nombre *</label>
          <input className={inputCls} value={station.name || ''} onChange={(e) => onChange('name', e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>PIN (4 dígitos) *</label>
          <div className="relative">
            <input
              className={inputCls + ' pr-10'}
              type={showPin ? 'text' : 'password'}
              maxLength={4}
              inputMode="numeric"
              value={station.pin || ''}
              onChange={(e) => onChange('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-light-200/40 hover:text-light-200"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>Rol {isCore && <span className="text-light-200/30">(bloqueado para estaciones base)</span>}</label>
          <select
            className={inputCls}
            value={station.role || 'cajero'}
            disabled={isCore}
            onChange={(e) => onChange('role', e.target.value)}
          >
            <option value="admin">Administración</option>
            <option value="cajero">Cajero</option>
            <option value="kitchen">Cocina</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Productos que recibe (tags)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(station.productTags || []).map((tag) => (
              <span key={tag} className="flex items-center gap-1.5 rounded-lg border border-main-500/50 bg-main-500/10 px-2.5 py-1 text-xs text-light-100">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="text-light-200/40 hover:text-red-400">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputCls}
              list="station-tag-suggestions"
              placeholder="Ej. bebidas, postres"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            />
            <datalist id="station-tag-suggestions">
              {tagSuggestions.map((tag) => <option key={tag} value={tag} />)}
            </datalist>
            <button
              type="button"
              onClick={addTag}
              className="shrink-0 rounded-xl border border-main-500/30 bg-main-600/20 px-3 text-sm text-main-300 hover:bg-main-600/40 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>Pantallas deshabilitadas para esta estación</label>
          <div className="flex flex-wrap gap-2">
            {SIDEBAR_ORDER.map((routeKey) => {
              const checked = (station.disabledRoutes || []).includes(routeKey)
              return (
                <label key={routeKey} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${checked ? 'border-main-500/50 bg-main-500/10 text-light-100' : 'border-white/10 text-light-200/50 hover:border-white/20'}`}>
                  <input type="checkbox" className="accent-main-500 h-3 w-3" checked={checked} onChange={() => toggleRoute(routeKey)} />
                  {NAV_ITEMS[routeKey].name}
                </label>
              )
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-light-200/30">Se muestran en gris y no se puede acceder a ellas desde esta estación.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-light-200/70 hover:bg-white/10 transition-colors">
            Cancelar
          </button>
          <button onClick={onSave} disabled={isSubmitting} className="flex-1 rounded-xl bg-main-500 py-2.5 text-sm font-semibold text-white hover:bg-main-400 transition-colors disabled:opacity-50">
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </Drawer>
  )
}

export const StationsManager = () => {
  const { stations } = useStationContext()
  const [productCounts, setProductCounts] = useState({})
  const [revealedPin, setRevealedPin] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingStation, setEditingStation] = useState(null)
  const [draft, setDraft] = useState(emptyStation())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const allTags = Array.from(new Set(stations.flatMap((s) => s.productTags || [])))

  useEffect(() => {
    let alive = true
    getDocs(collection(db, 'products')).then((snap) => {
      if (!alive) return
      const counts = {}
      snap.docs.forEach((d) => {
        const tags = d.data().stationTags || []
        if (!tags.length) return
        stations.forEach((station) => {
          if ((station.productTags || []).some((t) => tags.includes(t))) {
            counts[station.id] = (counts[station.id] || 0) + 1
          }
        })
      })
      setProductCounts(counts)
    }).catch(() => {})
    return () => { alive = false }
  }, [stations])

  const openAdd = () => {
    setEditingStation(null)
    setDraft(emptyStation())
    setError('')
    setDrawerOpen(true)
  }

  const openEdit = (station) => {
    setEditingStation(station)
    setDraft({ ...station })
    setError('')
    setDrawerOpen(true)
  }

  const handleChange = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!draft.name?.trim()) { setError('El nombre es obligatorio.'); return }
    if (!/^\d{4}$/.test(draft.pin || '')) { setError('El PIN debe tener 4 dígitos.'); return }

    setIsSubmitting(true)
    setError('')
    try {
      const payload = {
        name: draft.name.trim(),
        pin: draft.pin,
        role: draft.role || 'cajero',
        productTags: draft.productTags || [],
        disabledRoutes: draft.disabledRoutes || [],
        isCore: !!draft.isCore,
        updatedAt: serverTimestamp(),
      }
      if (editingStation) {
        await updateDoc(doc(db, 'stations', editingStation.id), payload)
      } else {
        await addDoc(collection(db, 'stations'), { ...payload, createdAt: serverTimestamp() })
      }
      setDrawerOpen(false)
    } catch (err) {
      setError('No se pudo guardar la estación.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, 'stations', deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting station:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-light-100">Estaciones</h1>
          <p className="text-sm text-light-200/50 mt-0.5">Gestiona los puntos de acceso, roles y enrutamiento de cocina.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-main-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-main-400 transition-colors cursor-pointer"
        >
          <Plus size={16} /> Nueva estación
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map((station) => {
          const RoleIcon = ROLE_ICONS[station.role] || ChefHat
          return (
          <div key={station.id} className="rounded-2xl border border-white/10 bg-main-900/40 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-main-500/15 border border-main-500/20 flex items-center justify-center text-main-300">
                  <RoleIcon size={16} />
                </div>
                <div>
                  <p className="font-semibold text-light-100">{station.name}</p>
                  <p className="text-xs text-light-200/40">{ROLE_LABELS[station.role] || station.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(station)} className="p-1.5 rounded-lg text-light-200/40 hover:text-light-100 hover:bg-white/5 transition-colors cursor-pointer">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => !station.isCore && setDeleteTarget(station)}
                  disabled={station.isCore}
                  title={station.isCore ? 'Las estaciones base no se pueden eliminar' : 'Eliminar'}
                  className="p-1.5 rounded-lg text-light-200/40 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-light-200/40"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-light-200/40">PIN:</span>
              <span className="font-mono text-light-100">{revealedPin === station.id ? station.pin : '••••'}</span>
              <button onClick={() => setRevealedPin((v) => v === station.id ? null : station.id)} className="text-light-200/30 hover:text-light-200 cursor-pointer">
                {revealedPin === station.id ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>

            <p className="text-xs text-light-200/40">{productCounts[station.id] || 0} productos enrutados</p>

            {(station.productTags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {station.productTags.map((tag) => (
                  <span key={tag} className="rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] text-light-200/50">{tag}</span>
                ))}
              </div>
            )}
          </div>
          )
        })}
      </div>

      <StationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingStation ? 'Editar estación' : 'Nueva estación'}
        station={draft}
        onChange={handleChange}
        onSave={handleSave}
        isSubmitting={isSubmitting}
        error={error}
        isCore={!!editingStation?.isCore}
        tagSuggestions={allTags}
      />

      {deleteTarget && (
        <ConfirmDialog
          message={`¿Eliminar la estación "${deleteTarget.name}"? Los productos asignados volverán a Cajero.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isPending={isDeleting}
        />
      )}
    </div>
  )
}
