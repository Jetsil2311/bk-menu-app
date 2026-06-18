/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { writeBatch, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAdminData } from '../../hooks/useAdminData'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  GripVertical,
  X,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Layers,
  Candy,
  MonitorPlay,
  RefreshCcw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

// ── Shared input style ────────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-xl border border-white/10 bg-main-900/60 px-3 py-2.5 text-sm text-light-100 placeholder-light-200/30 outline-none transition focus:border-main-500/50 focus:ring-1 focus:ring-main-500/20'

const labelCls = 'block text-xs font-medium text-light-200/60 mb-1.5'

// ── Option Groups Editor ──────────────────────────────────────────────────────
// Renders inside ProductDrawer to manage the optionGroups array.
const OptionGroupsEditor = ({ groups = [], onChange }) => {
  const addGroup = () => {
    const newGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: '',
      type: 'single',
      required: false,
      options: [],
    }
    onChange([...groups, newGroup])
  }

  const updateGroup = (gIdx, field, value) => {
    const next = [...groups]
    next[gIdx] = { ...next[gIdx], [field]: value }
    onChange(next)
  }

  const removeGroup = (gIdx) => {
    onChange(groups.filter((_, i) => i !== gIdx))
  }

  const addOption = (gIdx) => {
    const newOption = {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: '',
      priceModifier: 0,
    }
    const next = [...groups]
    next[gIdx] = { ...next[gIdx], options: [...(next[gIdx].options || []), newOption] }
    onChange(next)
  }

  const updateOption = (gIdx, oIdx, field, value) => {
    const next = [...groups]
    const opts = [...(next[gIdx].options || [])]
    opts[oIdx] = { ...opts[oIdx], [field]: value }
    next[gIdx] = { ...next[gIdx], options: opts }
    onChange(next)
  }

  const removeOption = (gIdx, oIdx) => {
    const next = [...groups]
    next[gIdx] = {
      ...next[gIdx],
      options: (next[gIdx].options || []).filter((_, i) => i !== oIdx),
    }
    onChange(next)
  }

  return (
    <div className="col-span-2 space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className={labelCls + ' mb-0'}>Grupos de Opciones</span>
        <button
          type="button"
          onClick={addGroup}
          className="flex items-center gap-1 rounded-lg border border-main-500/30 bg-main-600/20 px-2.5 py-1 text-xs font-medium text-main-300 transition-colors hover:bg-main-600/40 cursor-pointer"
        >
          <Plus size={12} /> Agregar grupo
        </button>
      </div>

      {groups.length === 0 && (
        <p className="text-[11px] italic text-light-200/25">
          Sin grupos configurados. Agrega grupos para mostrar opciones al cliente (Sabores, Estilo, Temperatura, etc.).
        </p>
      )}

      {groups.map((group, gIdx) => (
        <div
          key={group.id}
          className="rounded-xl border border-amber-900/20 p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          {/* Row 1: drag handle + name + required toggle */}
          <div className="flex items-center gap-2">
            <GripVertical
              size={14}
              className="text-light-200/20 shrink-0 cursor-grab"
            />
            <input
              className={inputCls + ' flex-1'}
              placeholder="Nombre del grupo, ej. Sabores"
              value={group.name}
              onChange={(e) => updateGroup(gIdx, 'name', e.target.value)}
            />
            {/* Required toggle */}
            <button
              type="button"
              onClick={() => updateGroup(gIdx, 'required', !group.required)}
              title={group.required ? 'Requerido — clic para desactivar' : 'Opcional — clic para hacer requerido'}
              className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                group.required
                  ? 'border-red-500/30 bg-red-500/15 text-red-300'
                  : 'border-white/10 bg-white/5 text-light-200/30 hover:border-white/20'
              }`}
            >
              * req
            </button>
          </div>

          {/* Row 2: type toggle — single / multi */}
          <div className="flex gap-2">
            {[
              { value: 'single', label: 'Elige 1' },
              { value: 'multi', label: 'Elige varios' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateGroup(gIdx, 'type', opt.value)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  group.type === opt.value
                    ? 'border border-main-500/40 bg-main-500/20 text-main-300'
                    : 'border border-white/10 bg-white/5 text-light-200/40 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Options list */}
          {(group.options || []).length > 0 && (
            <div className="space-y-2">
              {(group.options || []).map((opt, oIdx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    className={inputCls + ' flex-1'}
                    placeholder="Nombre, ej. Mango"
                    value={opt.name}
                    onChange={(e) =>
                      updateOption(gIdx, oIdx, 'name', e.target.value)
                    }
                  />
                  <div className="relative w-24 shrink-0">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-light-200/30">
                      +$
                    </span>
                    <input
                      className={inputCls + ' pl-7'}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={opt.priceModifier === 0 ? '' : opt.priceModifier}
                      onChange={(e) =>
                        updateOption(
                          gIdx,
                          oIdx,
                          'priceModifier',
                          e.target.value === '' ? 0 : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOption(gIdx, oIdx)}
                    className="shrink-0 p-1.5 rounded-lg text-light-200/30 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    aria-label="Eliminar opción"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add option */}
          <button
            type="button"
            onClick={() => addOption(gIdx)}
            className="flex items-center gap-1 text-xs text-main-400 hover:text-main-300 transition-colors cursor-pointer"
          >
            <Plus size={12} /> Agregar opción
          </button>

          {/* Group footer: delete group */}
          <div
            className="flex justify-end pt-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <button
              type="button"
              onClick={() => removeGroup(gIdx)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-light-200/25 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Trash2 size={12} /> Eliminar grupo
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Slide-over drawer wrapper ─────────────────────────────────────────────────
const Drawer = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        const form = document.activeElement?.closest('form')
        if (form) { e.preventDefault(); form.requestSubmit() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-[#1c0a04] border-l border-white/10 shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#1c0a04] z-10">
          <h2 className="text-base font-semibold text-light-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-light-200/50 hover:text-light-100 hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 px-6 py-5">{children}</div>
      </div>
    </>
  )
}

// ── Confirm delete dialog ─────────────────────────────────────────────────────
const DeleteConfirm = ({ label, onConfirm, onCancel, loading }) => (
  <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1c0a04] p-6 shadow-2xl">
      <h3 className="text-base font-semibold text-light-100">¿Eliminar?</h3>
      <p className="mt-1 text-sm text-light-200/60">{label}</p>
      <div className="mt-5 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-light-200/70 hover:bg-white/10 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
        >
          {loading ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </div>
  </div>
)

// ── Product drawer form ───────────────────────────────────────────────────────
const ProductDrawer = ({
  isOpen, onClose, title,
  item, onChange,
  onSave, onImageChange,
  isSubmitting, error, success,
  menuSections, menuSectionsLoading,
  toppingsList,
}) => {
  const BASE_URL = import.meta.env.BASE_URL
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={item.name || ''} onChange={e => onChange('name', e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Sección *</label>
            {menuSectionsLoading ? (
              <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
            ) : (
              <select
                className={inputCls}
                value={item.section || ''}
                onChange={e => onChange('section', e.target.value)}
              >
                <option value="">Selecciona sección</option>
                {menuSections.map(s => (
                  <option key={s.docId ?? s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className={labelCls}>Precio *</label>
            <input className={inputCls} type="number" min="0" step="0.01" value={item.price ?? ''} onChange={e => onChange('price', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Descripción corta</label>
            <input className={inputCls} value={item.desc || ''} onChange={e => onChange('desc', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Descripción larga</label>
            <textarea className={inputCls + ' resize-none'} rows={3} value={item.long_desc || ''} onChange={e => onChange('long_desc', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Sabores (separados por comas)</label>
            <input className={inputCls} placeholder="Taro, Mango, Matcha" value={item.flavorsText || ''} onChange={e => onChange('flavorsText', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Imagen</label>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl overflow-hidden bg-main-800 border border-white/10 flex items-center justify-center shrink-0">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : item.id ? (
                  <img src={`${BASE_URL}products/${item.id}${item.image ?? ''}`} alt="" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <ImageIcon size={20} className="text-light-200/20" />
                )}
              </div>
              <input type="file" accept="image/*" onChange={e => onImageChange(e.target.files?.[0] ?? null)} className="text-xs text-light-200/50 file:mr-3 file:rounded-lg file:border-0 file:bg-main-700 file:px-3 file:py-1.5 file:text-xs file:text-light-200 hover:file:bg-main-600" />
            </div>
          </div>
          {toppingsList.length > 0 && (
            <div className="col-span-2">
              <label className={labelCls}>Toppings disponibles</label>
              <div className="flex flex-wrap gap-2">
                {toppingsList.map(t => {
                  const checked = (item.toppingIds || []).includes(t.docId)
                  return (
                    <label key={t.docId} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${checked ? 'border-main-500/50 bg-main-500/10 text-light-100' : 'border-white/10 text-light-200/50 hover:border-white/20'}`}>
                      <input type="checkbox" className="accent-main-500 h-3 w-3" checked={checked} onChange={() => onChange('toppingIds', checked ? (item.toppingIds || []).filter(id => id !== t.docId) : [...(item.toppingIds || []), t.docId])} />
                      {t.name} (+${t.price})
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          {/* Option Groups */}
          <OptionGroupsEditor
            groups={Array.isArray(item.optionGroups) ? item.optionGroups : []}
            onChange={(groups) => onChange('optionGroups', groups)}
          />

          <div className="col-span-2 flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-sm text-light-200/70">Disponible (activo)</span>
            <button type="button" onClick={() => onChange('isActive', item.isActive === false ? true : false)} className={`transition-colors ${item.isActive !== false ? 'text-main-400' : 'text-light-200/20'}`}>
              {item.isActive !== false ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
            <Check size={14} /> {success}
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

// ── Section drawer form ───────────────────────────────────────────────────────
const SectionDrawer = ({ isOpen, onClose, title, item, onChange, onSave, isSubmitting, error, success }) => (
  <Drawer isOpen={isOpen} onClose={onClose} title={title}>
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Nombre *</label>
        <input className={inputCls} value={item.name || ''} onChange={e => onChange('name', e.target.value)} required />
      </div>
      <div>
        <label className={labelCls}>Categoría (ruta URL) *</label>
        <input className={inputCls} placeholder="bebidas" value={item.category || ''} onChange={e => onChange('category', e.target.value)} required />
      </div>
      <div>
        <label className={labelCls}>Descripción</label>
        <input className={inputCls} value={item.desc || ''} onChange={e => onChange('desc', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Orden (número)</label>
        <input className={inputCls} type="number" min="0" value={item.order ?? ''} onChange={e => onChange('order', e.target.value)} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
          <Check size={14} /> {success}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-light-200/70 hover:bg-white/10 transition-colors">Cancelar</button>
        <button onClick={onSave} disabled={isSubmitting} className="flex-1 rounded-xl bg-main-500 py-2.5 text-sm font-semibold text-white hover:bg-main-400 transition-colors disabled:opacity-50">
          {isSubmitting ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  </Drawer>
)

// ── Products tab ──────────────────────────────────────────────────────────────
const ProductsTab = ({ data }) => {
  const {
    menuItems, menuLoading, menuError, menuSections, menuSectionsLoading,
    menuSectionsError, menuSavingId, toppingsList,
    handleSaveMenuItem, handleDeleteMenuItem, handleToggleProductActive, handleToggleSectionVisible,
    handleAddProduct, handleAddSection, handleSaveSection, handleDeleteSection,
    editingItem, setEditingItem, editingImageFile, setEditingImageFile,
    deleteTarget, setDeleteTarget,
    editingSection, setEditingSection,
    deleteSectionTarget, setDeleteSectionTarget,
    isSubmitting, error, setError,
    productName, setProductName, productSection, setProductSection,
    productDesc, setProductDesc, productLongDesc, setProductLongDesc,
    productPrice, setProductPrice, productFlavors, setProductFlavors,
    productImage, setProductImage, productImageFile, setProductImageFile,
    productToppingIds, setProductToppingIds, productOptionGroups, productSuccess,
    sectionName, setSectionName, sectionCategory, setSectionCategory,
    sectionDesc, setSectionDesc, sectionOrder, setSectionOrder,
    sectionSuccess, setSectionSuccess,
    loadMenuItems, loadMenuSections,
  } = data

  const [collapsedSections, setCollapsedSections] = useState({})
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [dragOverSection, setDragOverSection] = useState(null)
  const dragSectionRef = useRef(null)

  // Open drawer if navigated here with state
  const location = useLocation()
  useEffect(() => {
    if (location.state?.openAddProduct) {
      setAddProductOpen(true)
      window.history.replaceState({}, '')
    }
    if (location.state?.openAddSection) {
      setAddSectionOpen(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const toggleSection = (name) =>
    setCollapsedSections(prev => ({ ...prev, [name]: !prev[name] }))

  // Group products by section preserving section order
  const grouped = menuSections.map(sec => ({
    section: sec,
    products: menuItems.filter(p => p.section === sec.name),
  }))
  // Ungrouped products (section not in menuSections list)
  const ungroupedSections = [...new Set(menuItems.filter(p => !menuSections.find(s => s.name === p.section)).map(p => p.section))]
  ungroupedSections.forEach(name => {
    grouped.push({ section: { name, docId: null }, products: menuItems.filter(p => p.section === name) })
  })

  // New product form state object for add drawer
  const newProductObj = {
    name: productName, section: productSection, desc: productDesc,
    long_desc: productLongDesc, price: productPrice, flavorsText: productFlavors,
    image: productImage, toppingIds: productToppingIds,
    optionGroups: productOptionGroups || [],
    isActive: true,
  }

  const handleNewProductChange = (field, value) => {
    const setters = {
      name: setProductName, section: setProductSection, desc: setProductDesc,
      long_desc: setProductLongDesc, price: setProductPrice, flavorsText: setProductFlavors,
      image: setProductImage, toppingIds: setProductToppingIds,
      optionGroups: data.setProductOptionGroups,
    }
    setters[field]?.(value)
  }

  const handleSaveNewProduct = () => {
    handleAddProduct({ preventDefault: () => {} })
  }

  // Edit product form state object
  const handleEditChange = (field, value) => {
    setEditingItem(prev => prev ? { ...prev, [field]: value } : prev)
  }

  const handleSaveEdit = () => {
    if (editingItem) handleSaveMenuItem(editingItem)
  }

  // New section form state object
  const newSectionObj = { name: sectionName, category: sectionCategory, desc: sectionDesc, order: sectionOrder }
  const handleNewSectionChange = (field, value) => {
    const setters = { name: setSectionName, category: setSectionCategory, desc: setSectionDesc, order: setSectionOrder }
    setters[field]?.(value)
  }
  const handleSaveNewSection = () => {
    handleAddSection({ preventDefault: () => {} })
  }

  // Section drag-and-drop reorder
  const handleSectionDragStart = (idx) => {
    dragSectionRef.current = idx
  }
  const handleSectionDragOver = (e, idx) => {
    e.preventDefault()
    setDragOverSection(idx)
  }
  const handleSectionDrop = async (dropIdx) => {
    setDragOverSection(null)
    const fromIdx = dragSectionRef.current
    dragSectionRef.current = null
    if (fromIdx === null || fromIdx === dropIdx) return

    // Reorder the docId-backed sections only
    const docSections = grouped.filter(g => g.section.docId)
    if (fromIdx >= docSections.length || dropIdx >= docSections.length) return

    const reordered = [...docSections]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(dropIdx, 0, moved)

    // Persist new order via writeBatch
    try {
      const batch = writeBatch(db)
      reordered.forEach(({ section }, i) => {
        batch.update(doc(db, 'sections', section.docId), { order: i })
      })
      await batch.commit()
      // Reload sections to reflect new order
      loadMenuSections()
    } catch (err) {
      console.error('Error reordering sections:', err)
    }
  }

  // Edit section state
  const handleEditSectionChange = (field, value) => {
    setEditingSection(prev => prev ? { ...prev, [field]: value } : prev)
  }
  const handleSaveEditSection = () => {
    if (editingSection) handleSaveSection({ ...editingSection, originalName: editingSection._originalName ?? editingSection.name })
  }

  const BASE_URL = import.meta.env.BASE_URL

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setAddProductOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-main-500 px-4 py-2 text-sm font-semibold text-white hover:bg-main-400 transition-colors shadow-lg shadow-main-500/10"
        >
          <Plus size={16} /> Agregar producto
        </button>
        <button
          onClick={() => setAddSectionOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-light-200/70 hover:bg-white/10 hover:text-light-100 transition-colors"
        >
          <Layers size={16} /> Nueva sección
        </button>
        <button
          onClick={() => { loadMenuItems(); loadMenuSections() }}
          className="ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-light-200/50 hover:text-light-100 hover:bg-white/10 transition-colors"
        >
          <RefreshCcw size={13} /> Recargar
        </button>
      </div>

      {menuError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} /> {menuError}
        </div>
      )}

      {menuLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-main-900/20 p-12 text-center text-light-200/30 italic">
          No hay secciones ni productos. Agrega una sección para comenzar.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ section, products }, idx) => (
            <div
              key={section.docId ?? section.name}
              className={`rounded-2xl border overflow-hidden transition-colors ${dragOverSection === idx ? 'border-main-500/60 bg-main-500/5' : 'border-white/8 bg-main-900/20'}`}
              draggable={Boolean(section.docId)}
              onDragStart={() => handleSectionDragStart(idx)}
              onDragOver={(e) => handleSectionDragOver(e, idx)}
              onDrop={() => handleSectionDrop(idx)}
              onDragLeave={() => setDragOverSection(null)}
            >
              {/* Section header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-main-900/40 border-b border-white/5">
                <GripVertical size={16} className={`shrink-0 ${section.docId ? 'text-light-200/30 cursor-grab' : 'text-light-200/10'}`} />
                <button onClick={() => toggleSection(section.name)} className="flex items-center gap-2 flex-1 text-left">
                  <span className="font-semibold text-light-100 text-sm">{section.name}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-light-200/50">{products.length}</span>
                  <ChevronDown size={14} className={`ml-auto text-light-200/40 transition-transform ${collapsedSections[section.name] ? '-rotate-90' : ''}`} />
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {section.docId && (
                    <>
                      <button
                        onClick={() => data.handleToggleSectionVisible(section)}
                        disabled={menuSavingId === section.docId}
                        title={section.visible !== false ? 'Visible' : 'Oculta'}
                        className={`transition-colors ${section.visible !== false ? 'text-emerald-400' : 'text-light-200/20'} disabled:opacity-40`}
                      >
                        {section.visible !== false ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      <button
                        onClick={() => setEditingSection({ ...section, _originalName: section.name })}
                        className="p-1.5 rounded-lg text-light-200/40 hover:text-light-100 hover:bg-white/10 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteSectionTarget(section)}
                        className="p-1.5 rounded-lg text-light-200/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Products list */}
              {!collapsedSections[section.name] && (
                <div className="divide-y divide-white/5">
                  {products.length === 0 ? (
                    <p className="px-5 py-4 text-xs text-light-200/30 italic">No hay productos en esta sección.</p>
                  ) : (
                    products.map(product => (
                      <div key={product.docId} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group">
                        {/* Thumbnail */}
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-main-800 border border-white/10 shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <img
                              src={`${BASE_URL}products/${product.id}${product.image ?? ''}`}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={e => { e.currentTarget.style.display = 'none' }}
                            />
                          )}
                        </div>
                        {/* Name + price */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-light-100 truncate">{product.name}</p>
                          <p className="text-xs text-light-200/40">${Number(product.price).toLocaleString('es-MX')}</p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleToggleProductActive(product)}
                            disabled={menuSavingId === product.docId}
                            title={product.isActive !== false ? 'Activo' : 'Agotado'}
                            className={`transition-colors ${product.isActive !== false ? 'text-emerald-400' : 'text-light-200/20'} disabled:opacity-40`}
                          >
                            {product.isActive !== false ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(product)
                              setEditingImageFile(null)
                            }}
                            className="p-1.5 rounded-lg text-light-200/40 hover:text-light-100 hover:bg-white/10 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(product)}
                            className="p-1.5 rounded-lg text-light-200/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add product drawer */}
      <ProductDrawer
        isOpen={addProductOpen}
        onClose={() => setAddProductOpen(false)}
        title="Agregar producto"
        item={newProductObj}
        onChange={handleNewProductChange}
        onSave={handleSaveNewProduct}
        onImageChange={setProductImageFile}
        isSubmitting={isSubmitting}
        error={error}
        success={productSuccess}
        menuSections={menuSections}
        menuSectionsLoading={menuSectionsLoading}
        toppingsList={toppingsList}
      />

      {/* Edit product drawer */}
      <ProductDrawer
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Editar producto"
        item={editingItem ?? {}}
        onChange={handleEditChange}
        onSave={handleSaveEdit}
        onImageChange={setEditingImageFile}
        isSubmitting={menuSavingId === editingItem?.docId}
        error={menuError}
        success=""
        menuSections={menuSections}
        menuSectionsLoading={menuSectionsLoading}
        toppingsList={toppingsList}
      />

      {/* Add section drawer */}
      <SectionDrawer
        isOpen={addSectionOpen}
        onClose={() => setAddSectionOpen(false)}
        title="Agregar sección"
        item={newSectionObj}
        onChange={handleNewSectionChange}
        onSave={handleSaveNewSection}
        isSubmitting={isSubmitting}
        error={error}
        success={sectionSuccess}
      />

      {/* Edit section drawer */}
      <SectionDrawer
        isOpen={Boolean(editingSection)}
        onClose={() => setEditingSection(null)}
        title="Editar sección"
        item={editingSection ?? {}}
        onChange={handleEditSectionChange}
        onSave={handleSaveEditSection}
        isSubmitting={menuSavingId === editingSection?.docId}
        error={menuSectionsError}
        success=""
      />

      {/* Delete product confirm */}
      {deleteTarget && (
        <DeleteConfirm
          label={`¿Seguro que deseas eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.`}
          loading={menuSavingId === deleteTarget.docId}
          onConfirm={async () => { await handleDeleteMenuItem(deleteTarget); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Delete section confirm */}
      {deleteSectionTarget && (
        <DeleteConfirm
          label={`¿Eliminar la sección "${deleteSectionTarget.name}" y todos sus productos?`}
          loading={menuSavingId === deleteSectionTarget.docId}
          onConfirm={() => handleDeleteSection(deleteSectionTarget)}
          onCancel={() => setDeleteSectionTarget(null)}
        />
      )}
    </div>
  )
}

// ── Toppings tab ──────────────────────────────────────────────────────────────
const ToppingsTab = ({ data }) => {
  const {
    toppingsList, toppingsLoading, toppingsError, toppingsSuccess,
    toppingName, setToppingName, toppingPrice, setToppingPrice,
    toppingDescription, setToppingDescription,
    handleAddTopping, handleSaveTopping, handleDeleteTopping,
    editingTopping, setEditingTopping,
    deleteToppingTarget, setDeleteToppingTarget,
    isSubmitting, menuSavingId,
  } = data

  return (
    <div className="space-y-6 max-w-lg">
      {/* Add form */}
      <div className="rounded-2xl border border-white/8 bg-main-900/20 p-5">
        <h3 className="text-sm font-semibold text-light-100 mb-4">Agregar topping</h3>
        <form onSubmit={handleAddTopping} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Nombre *</label>
              <input className={inputCls} value={toppingName} onChange={e => setToppingName(e.target.value)} required />
            </div>
            <div className="w-28">
              <label className={labelCls}>Precio *</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={toppingPrice} onChange={e => setToppingPrice(e.target.value)} required />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={isSubmitting} className="rounded-xl bg-main-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-main-400 transition-colors disabled:opacity-50">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Descripción (opcional)</label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={2}
              value={toppingDescription}
              onChange={e => setToppingDescription(e.target.value)}
              placeholder="Breve descripción del topping…"
            />
          </div>
        </form>
        {toppingsError && <p className="mt-2 text-xs text-red-400">{toppingsError}</p>}
        {toppingsSuccess && <p className="mt-2 text-xs text-emerald-400">{toppingsSuccess}</p>}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-white/8 bg-main-900/20 overflow-hidden">
        {toppingsLoading ? (
          <div className="p-8 text-center text-light-200/30">Cargando...</div>
        ) : toppingsList.length === 0 ? (
          <div className="p-8 text-center text-light-200/30 italic">No hay toppings.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {toppingsList.map(t => (
              <div key={t.docId} className="flex items-center px-4 py-3 hover:bg-white/5 transition-colors group">
                {editingTopping?.docId === t.docId ? (
                  <form onSubmit={e => { e.preventDefault(); handleSaveTopping(editingTopping) }} className="flex-1 space-y-2">
                    <div className="flex gap-3">
                      <input className={inputCls + ' flex-1'} value={editingTopping.name} onChange={e => setEditingTopping(prev => ({ ...prev, name: e.target.value }))} autoFocus />
                      <input className={inputCls + ' w-24'} type="number" min="0" step="0.01" value={editingTopping.price} onChange={e => setEditingTopping(prev => ({ ...prev, price: e.target.value }))} />
                      <button type="submit" className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10"><Check size={16} /></button>
                      <button type="button" onClick={() => setEditingTopping(null)} className="p-2 rounded-lg text-light-200/40 hover:bg-white/10"><X size={16} /></button>
                    </div>
                    <textarea
                      className={inputCls + ' resize-none text-xs'}
                      rows={2}
                      placeholder="Descripción (opcional)"
                      value={editingTopping.description || ''}
                      onChange={e => setEditingTopping(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </form>
                ) : (
                  <>
                    <div className="flex-1">
                      <span className="text-sm text-light-100">{t.name}</span>
                      <span className="ml-2 text-xs text-light-200/40">+${t.price}</span>
                      {t.description && (
                        <p className="text-xs text-light-200/35 mt-0.5 leading-snug">{t.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingTopping(t)} className="p-1.5 rounded-lg text-light-200/40 hover:text-light-100 hover:bg-white/10 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteToppingTarget(t)} className="p-1.5 rounded-lg text-light-200/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteToppingTarget && (
        <DeleteConfirm
          label={`¿Eliminar el topping "${deleteToppingTarget.name}"?`}
          loading={false}
          onConfirm={() => handleDeleteTopping(deleteToppingTarget)}
          onCancel={() => setDeleteToppingTarget(null)}
        />
      )}
    </div>
  )
}

// ── Carousel tab ──────────────────────────────────────────────────────────────
const CarouselTab = ({ data }) => {
  const {
    carouselSlides, carouselLoading, carouselError, carouselSuccess,
    carouselAltText, setCarouselAltText,
    carouselLinkType, setCarouselLinkType,
    carouselLinkedId, setCarouselLinkedId,
    carouselOrder, setCarouselOrder,
    carouselActive, setCarouselActive,
    carouselImageFile, setCarouselImageFile,
    carouselProducts, carouselCombos, carouselItemsLoading,
    handleAddCarouselSlide, handleSaveCarouselSlide, handleDeleteCarouselSlide,
    handleToggleSlideActive,
    editingSlide, setEditingSlide, editingSlideImageFile, setEditingSlideImageFile,
    deleteSlideTarget, setDeleteSlideTarget,
    isSubmitting,
  } = data

  const linkedList = carouselLinkType === 'combo' ? carouselCombos : carouselProducts

  return (
    <div className="space-y-6">
      {/* Add slide form */}
      <div className="rounded-2xl border border-white/8 bg-main-900/20 p-5">
        <h3 className="text-sm font-semibold text-light-100 mb-4">Agregar diapositiva</h3>
        <form onSubmit={handleAddCarouselSlide} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Imagen *</label>
            <input type="file" accept="image/*" onChange={e => setCarouselImageFile(e.target.files?.[0] ?? null)} className="text-xs text-light-200/50 file:mr-3 file:rounded-lg file:border-0 file:bg-main-700 file:px-3 file:py-1.5 file:text-xs file:text-light-200 hover:file:bg-main-600" />
          </div>
          <div>
            <label className={labelCls}>Texto alternativo</label>
            <input className={inputCls} value={carouselAltText} onChange={e => setCarouselAltText(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Orden</label>
            <input className={inputCls} type="number" min="0" value={carouselOrder} onChange={e => setCarouselOrder(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Tipo de enlace</label>
            <select className={inputCls} value={carouselLinkType} onChange={e => setCarouselLinkType(e.target.value)}>
              <option value="product">Producto</option>
              <option value="combo">Combo</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Producto vinculado *</label>
            {carouselItemsLoading ? (
              <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
            ) : (
              <select className={inputCls} value={carouselLinkedId} onChange={e => setCarouselLinkedId(e.target.value)}>
                <option value="">Selecciona...</option>
                {linkedList.map(p => (
                  <option key={p.docId} value={p.docId}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="col-span-2 flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-sm text-light-200/70">Activa</span>
            <button type="button" onClick={() => setCarouselActive(v => !v)} className={carouselActive ? 'text-main-400' : 'text-light-200/20'}>
              {carouselActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>
          {carouselError && <p className="col-span-2 text-xs text-red-400">{carouselError}</p>}
          {carouselSuccess && <p className="col-span-2 text-xs text-emerald-400">{carouselSuccess}</p>}
          <div className="col-span-2">
            <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-main-500 py-2.5 text-sm font-semibold text-white hover:bg-main-400 transition-colors disabled:opacity-50">
              {isSubmitting ? 'Subiendo...' : 'Agregar diapositiva'}
            </button>
          </div>
        </form>
      </div>

      {/* Slides list */}
      <div className="rounded-2xl border border-white/8 bg-main-900/20 overflow-hidden">
        {carouselLoading ? (
          <div className="p-8 text-center text-light-200/30">Cargando carrusel...</div>
        ) : carouselSlides.length === 0 ? (
          <div className="p-8 text-center text-light-200/30 italic">No hay diapositivas.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {carouselSlides.map((slide, idx) => (
              <div key={slide.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group">
                <GripVertical size={16} className="text-light-200/20 shrink-0" />
                <div className="h-10 w-16 rounded-lg overflow-hidden bg-main-800 border border-white/10 shrink-0">
                  {slide.imageUrl && <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-light-100 truncate">{slide.altText || `Slide ${idx + 1}`}</p>
                  <p className="text-xs text-light-200/40">Orden: {slide.order} · {slide.linkType}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleToggleSlideActive(slide)} className={slide.active ? 'text-emerald-400' : 'text-light-200/20'}>
                    {slide.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => { setEditingSlide(slide); setEditingSlideImageFile(null) }} className="p-1.5 rounded-lg text-light-200/40 hover:text-light-100 hover:bg-white/10 transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteSlideTarget(slide)} className="p-1.5 rounded-lg text-light-200/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit slide drawer */}
      {editingSlide && (
        <Drawer isOpen={Boolean(editingSlide)} onClose={() => setEditingSlide(null)} title="Editar diapositiva">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Texto alternativo</label>
              <input className={inputCls} value={editingSlide.altText || ''} onChange={e => setEditingSlide(prev => ({ ...prev, altText: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Nueva imagen (opcional)</label>
              <input type="file" accept="image/*" onChange={e => setEditingSlideImageFile(e.target.files?.[0] ?? null)} className="text-xs text-light-200/50 file:mr-3 file:rounded-lg file:border-0 file:bg-main-700 file:px-3 file:py-1.5 file:text-xs file:text-light-200 hover:file:bg-main-600" />
            </div>
            <div>
              <label className={labelCls}>Orden</label>
              <input className={inputCls} type="number" min="0" value={editingSlide.order ?? ''} onChange={e => setEditingSlide(prev => ({ ...prev, order: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingSlide(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-light-200/70 hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={() => handleSaveCarouselSlide(editingSlide)} className="flex-1 rounded-xl bg-main-500 py-2.5 text-sm font-semibold text-white hover:bg-main-400 transition-colors">Guardar</button>
            </div>
          </div>
        </Drawer>
      )}

      {deleteSlideTarget && (
        <DeleteConfirm
          label={`¿Eliminar la diapositiva "${deleteSlideTarget.altText || 'esta diapositiva'}"?`}
          loading={carouselLoading}
          onConfirm={() => handleDeleteCarouselSlide(deleteSlideTarget)}
          onCancel={() => setDeleteSlideTarget(null)}
        />
      )}
    </div>
  )
}

// ── Main MenuEditor view ──────────────────────────────────────────────────────
const TABS = [
  { id: 'products', label: 'Productos', icon: Layers },
  { id: 'toppings', label: 'Toppings', icon: Candy },
  { id: 'carousel', label: 'Carrusel', icon: MonitorPlay },
]

export const MenuEditor = () => {
  const data = useAdminData()
  const location = useLocation()

  // Determine initial tab from route state
  const [activeTab, setActiveTab] = useState(
    location.state?.tab ?? 'products'
  )

  // Load all data on mount
  useEffect(() => {
    data.loadMenuItems()
    data.loadMenuSections()
    data.loadToppings()
    data.loadCarouselSlides()
    data.loadCarouselLinkedItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-white/8 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-main-500 text-main-400'
                : 'border-transparent text-light-200/50 hover:text-light-100'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'products' && <ProductsTab data={data} />}
      {activeTab === 'toppings' && <ToppingsTab data={data} />}
      {activeTab === 'carousel' && <CarouselTab data={data} />}
    </div>
  )
}
