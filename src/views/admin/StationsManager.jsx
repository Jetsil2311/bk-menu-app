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
  Plus, Pencil, Trash2, X, Eye, EyeOff, ChefHat, AlertCircle, Check, LayoutGrid, MonitorSmartphone,
} from 'lucide-react'
import {
  Drawer, Field, FormSection, Segmented, ChipCheck, Notice, inputCls, btnPrimary, btnSecondary, iconBtn,
} from '../../components/admin/ui'

const emptyStation = () => ({
  name: '', pin: '', role: 'cajero', productTags: [], disabledRoutes: [], isCore: false,
})

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administración' },
  { value: 'cajero', label: 'Cajero' },
  { value: 'kitchen', label: 'Cocina' },
]

const StationDrawer = ({ isOpen, onClose, title, station, onChange, onSave, isSubmitting, error, isCore, tagSuggestions }) => {
  const [showPin, setShowPin] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const tags = station.productTags || []
  const disabled = station.disabledRoutes || []

  const addTag = (raw = tagDraft) => {
    const value = raw.trim()
    if (!value || tags.includes(value)) { setTagDraft(''); return }
    onChange('productTags', [...tags, value])
    setTagDraft('')
  }
  const removeTag = (tag) => onChange('productTags', tags.filter((t) => t !== tag))

  // Stored as disabledRoutes; shown as "screens this station CAN use".
  const toggleRoute = (routeKey) => {
    onChange('disabledRoutes', disabled.includes(routeKey)
      ? disabled.filter((r) => r !== routeKey)
      : [...disabled, routeKey])
  }

  const canSave = Boolean(station.name?.trim()) && /^\d{4}$/.test(station.pin || '')
  const unusedSuggestions = tagSuggestions.filter((t) => !tags.includes(t))

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={btnSecondary + ' flex-1'}>Cancelar</button>
          <button type="button" onClick={onSave} disabled={isSubmitting || !canSave} className={btnPrimary + ' flex-1'}>
            {isSubmitting ? 'Guardando…' : 'Guardar estación'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormSection icon={MonitorSmartphone} title="Estación" hint="Un dispositivo del equipo: la caja, la tablet de cocina, tu celular…">
          <Field label="Nombre" required htmlFor="st-name">
            <input id="st-name" className={inputCls} value={station.name || ''} onChange={(e) => onChange('name', e.target.value)} placeholder="Ej. Barra de bebidas" />
          </Field>
          <Field label="PIN de 4 dígitos" required htmlFor="st-pin" hint="Se pide al elegir esta estación.">
            <div className="relative">
              <input
                id="st-pin"
                className={inputCls + ' pr-12 tracking-[0.4em] font-bold tabular-nums'}
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                inputMode="numeric"
                autoComplete="off"
                value={station.pin || ''}
                onChange={(e) => onChange('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                className={iconBtn + ' absolute right-1 top-1/2 -translate-y-1/2'}
              >
                {showPin ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
          <Field label="Tipo" hint={isCore ? 'Las estaciones base no pueden cambiar de tipo.' : 'Administración ve todo · Cajero cobra · Cocina solo ve los pedidos a preparar.'}>
            {isCore ? (
              <p className="min-h-[44px] flex items-center rounded-xl bg-main-800 px-3.5 text-sm font-bold">{ROLE_LABELS[station.role] || station.role}</p>
            ) : (
              <Segmented ariaLabel="Tipo de estación" value={station.role || 'cajero'} onChange={(v) => onChange('role', v)} options={ROLE_OPTIONS} />
            )}
          </Field>
        </FormSection>

        <FormSection icon={ChefHat} title="Pedidos que recibe" hint="Etiquetas de productos que se mandan a esta estación (ej. “bebidas”). En cada producto eliges su etiqueta en “¿Quién lo prepara?”.">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-primary pl-3.5 pr-1 text-sm font-bold text-snow">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} aria-label={`Quitar ${tag}`} className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-snow/20 cursor-pointer">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {unusedSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {unusedSuggestions.map((tag) => (
                <ChipCheck key={tag} checked={false} onChange={() => addTag(tag)}><Plus size={14} /> {tag}</ChipCheck>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className={inputCls}
              aria-label="Nueva etiqueta"
              placeholder="Nueva etiqueta, ej. postres"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            />
            <button type="button" onClick={() => addTag()} className={btnSecondary + ' shrink-0'} aria-label="Agregar etiqueta">
              <Plus size={16} />
            </button>
          </div>
        </FormSection>

        {station.role === 'kitchen' ? (
          <p className="rounded-2xl bg-main-900 border border-white/10 px-4 py-3 text-sm text-light-200/80">
            Las estaciones de <b>Cocina</b> solo ven la pantalla de pedidos a preparar.
          </p>
        ) : (
          <FormSection icon={LayoutGrid} title="Pantallas que puede usar" hint="Las que apagues se verán en gris y no se podrán abrir desde esta estación.">
            <div className="flex flex-wrap gap-2">
              {SIDEBAR_ORDER.map((routeKey) => {
                const allowed = !disabled.includes(routeKey)
                return (
                  <ChipCheck key={routeKey} checked={allowed} onChange={() => toggleRoute(routeKey)}>
                    {allowed && <Check size={14} />} {NAV_ITEMS[routeKey].name}
                  </ChipCheck>
                )
              })}
            </div>
          </FormSection>
        )}

        {error && <Notice icon={AlertCircle}>{error}</Notice>}
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
        <p className="text-sm text-light-200/75 max-w-xl">Cada estación es un dispositivo del equipo (caja, cocina…) con su propio PIN y las pantallas que puede usar.</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-main-500 px-4 py-2.5 text-sm font-semibold text-snow hover:bg-main-400 transition-colors cursor-pointer"
        >
          <Plus size={16} /> Nueva estación
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map((station) => {
          const RoleIcon = ROLE_ICONS[station.role] || ChefHat
          return (
          <div key={station.id} className="rounded-2xl border border-white/10 bg-main-900 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-main-500/15 border border-main-500/20 flex items-center justify-center text-main-300">
                  <RoleIcon size={16} />
                </div>
                <div>
                  <p className="font-semibold text-light-100">{station.name}</p>
                  <p className="text-xs text-light-200/65">{ROLE_LABELS[station.role] || station.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(station)} className="p-1.5 rounded-lg text-light-200/65 hover:text-light-100 hover:bg-white/5 transition-colors cursor-pointer">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => !station.isCore && setDeleteTarget(station)}
                  disabled={station.isCore}
                  title={station.isCore ? 'Las estaciones base no se pueden eliminar' : 'Eliminar'}
                  className="p-1.5 rounded-lg text-light-200/65 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-light-200/65"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-light-200/65">PIN:</span>
              <span className="font-mono text-light-100">{revealedPin === station.id ? station.pin : '••••'}</span>
              <button onClick={() => setRevealedPin((v) => v === station.id ? null : station.id)} className="text-light-200/55 hover:text-light-200 cursor-pointer">
                {revealedPin === station.id ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>

            <p className="text-xs text-light-200/65">{productCounts[station.id] || 0} productos enrutados</p>

            {(station.productTags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {station.productTags.map((tag) => (
                  <span key={tag} className="rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] text-light-200/70">{tag}</span>
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
