/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { writeBatch, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAdminData } from '../../hooks/useAdminData'
import { useStationContext } from '../../context/StationContext'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { MenuCard } from '../../components/MenuCard'
import { DrinkBuilderEditor } from '../../components/admin/drinkBuilder/DrinkBuilderEditor'
import { getSectionTone } from '../../utils/menuTheme'
import {
  addOptionToGroup,
  createMenuOption,
  createOptionGroup,
  removeOptionFromGroup,
  removeOptionGroup,
  updateOptionGroup,
  updateOptionInGroup,
} from '../../utils/menuOptionGroups'
import {
  Drawer, Field, FormSection, Toggle, MiniSwitch, Segmented, ChipCheck, Notice, EmptyState,
  inputCls, textareaCls, btnPrimary, btnSecondary, iconBtn, iconBtnDanger,
} from '../../components/admin/ui'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  GripVertical,
  Check,
  AlertCircle,
  ImagePlus,
  Layers,
  Candy,
  MonitorPlay,
  RefreshCcw,
  Search,
  Eye,
  EyeOff,
  SlidersHorizontal,
  CupSoda,
  ChefHat,
  Info,
  ArrowUp,
  ArrowDown,
  Smartphone,
} from 'lucide-react'

const BASE_URL = import.meta.env.BASE_URL

const productImageSrc = (p) =>
  p?.imageUrl || (p?.id !== undefined && p?.id !== null && p?.id !== '' ? `${BASE_URL}products/${p.id}${p.image ?? ''}` : '')

// Small square product thumbnail with graceful fallback.
const Thumb = ({ src, className = 'h-12 w-12' }) => {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-xl bg-main-800 flex items-center justify-center`}>
      {src && !failed
        ? <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        : <ImagePlus size={18} className="text-light-200/45" />}
    </div>
  )
}

// Image picker: shows the current/new photo and a big tap target to change it.
const ImagePicker = ({ currentSrc, onFile, aspect = 'aspect-[4/3]', hint }) => {
  const [preview, setPreview] = useState(null)
  const inputRef = useRef(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const src = preview || currentSrc
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`relative ${aspect} w-28 sm:w-32 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-white/20 bg-main-800 hover:border-primary/50 transition-colors cursor-pointer`}
        aria-label={src ? 'Cambiar foto' : 'Subir foto'}
      >
        {src
          ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
          : <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-light-200/60"><ImagePlus size={22} /><span className="text-xs font-semibold">Subir</span></span>}
      </button>
      <div className="min-w-0">
        <button type="button" onClick={() => inputRef.current?.click()} className={btnSecondary}>
          <ImagePlus size={16} /> {src ? 'Cambiar foto' : 'Elegir foto'}
        </button>
        {hint && <p className="mt-2 text-xs text-light-200/70 leading-snug">{hint}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          if (preview) URL.revokeObjectURL(preview)
          setPreview(file ? URL.createObjectURL(file) : null)
          onFile(file)
        }}
      />
    </div>
  )
}

// ── Option Groups Editor ──────────────────────────────────────────────────────
// Manages the product's optionGroups array: { id, name, type, required, options[] }.
const OptionGroupsEditor = ({ groups = [], onChange }) => {
  const addGroup = () => onChange([...groups, createOptionGroup()])
  const updateGroup = (gIdx, field, value) => onChange(updateOptionGroup(groups, gIdx, field, value))
  const removeGroup = (gIdx) => onChange(removeOptionGroup(groups, gIdx))
  const addOption = (gIdx) => onChange(addOptionToGroup(groups, gIdx, createMenuOption()))
  const updateOption = (gIdx, oIdx, field, value) => onChange(updateOptionInGroup(groups, gIdx, oIdx, field, value))
  const removeOption = (gIdx, oIdx) => onChange(removeOptionFromGroup(groups, gIdx, oIdx))

  return (
    <div className="space-y-3">
      {groups.length === 0 && (
        <p className="rounded-xl bg-main-800 px-4 py-3 text-sm text-light-200/75">
          Sin opciones. Agrega una pregunta para el cliente, por ejemplo <b>Sabor</b> (Taro, Mango…) o <b>Tamaño</b>.
        </p>
      )}

      {groups.map((group, gIdx) => (
        <div key={group.id} className="rounded-2xl border border-white/10 bg-main-800 p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <input
              className={inputCls + ' flex-1 font-semibold'}
              placeholder="Pregunta, ej. Sabor"
              aria-label="Nombre del grupo de opciones"
              value={group.name}
              onChange={(e) => updateGroup(gIdx, 'name', e.target.value)}
            />
            <button type="button" onClick={() => removeGroup(gIdx)} className={iconBtnDanger} aria-label="Eliminar pregunta">
              <Trash2 size={17} />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Segmented
              ariaLabel="Cuántas opciones puede elegir"
              value={group.type}
              onChange={(v) => updateGroup(gIdx, 'type', v)}
              options={[{ value: 'single', label: 'Elige 1' }, { value: 'multi', label: 'Elige varias' }]}
            />
            <div className="rounded-xl bg-main-900 px-3 py-1.5 flex items-center">
              <Toggle
                checked={Boolean(group.required)}
                onChange={(v) => updateGroup(gIdx, 'required', v)}
                label="Obligatorio"
              />
            </div>
          </div>

          <div className="space-y-2">
            {(group.options || []).map((opt, oIdx) => (
              <div key={opt.id} className="flex items-center gap-2">
                <input
                  className={inputCls + ' flex-1'}
                  placeholder="Opción, ej. Mango"
                  aria-label="Nombre de la opción"
                  value={opt.name}
                  onChange={(e) => updateOption(gIdx, oIdx, 'name', e.target.value)}
                />
                <div className="relative w-24 sm:w-28 shrink-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-light-200/60">+$</span>
                  <input
                    className={inputCls + ' pl-8 tabular-nums'}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    placeholder="0"
                    aria-label="Costo extra de la opción"
                    value={opt.priceModifier === 0 ? '' : opt.priceModifier}
                    onChange={(e) => updateOption(gIdx, oIdx, 'priceModifier', e.target.value === '' ? 0 : Number(e.target.value))}
                  />
                </div>
                <button type="button" onClick={() => removeOption(gIdx, oIdx)} className={iconBtnDanger} aria-label="Eliminar opción">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => addOption(gIdx)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-primary dark:text-main-300 hover:bg-primary/5 cursor-pointer">
            <Plus size={16} /> Agregar opción
          </button>
        </div>
      ))}

      <button type="button" onClick={addGroup} className={btnSecondary + ' w-full border-dashed'}>
        <Plus size={16} /> Agregar pregunta
      </button>
    </div>
  )
}

// ── Product drawer ────────────────────────────────────────────────────────────
const ProductDrawer = ({
  isOpen, onClose, title,
  item, onChange,
  onSave, onImageChange,
  isSubmitting, error,
  menuSections, menuSectionsLoading,
  toppingsList,
  stationTagOptions = [],
}) => {
  const [newImagePreview, setNewImagePreview] = useState(null)
  useEffect(() => { if (!isOpen) setNewImagePreview(null) }, [isOpen])

  const sectionIndex = Math.max(0, menuSections.findIndex((s) => s.name === item.section))
  const optionGroups = Array.isArray(item.optionGroups) ? item.optionGroups : []
  const selectedToppings = toppingsList.filter((t) => (item.toppingIds || []).includes(t.docId))
  const priceNumber = Number(item.price) || 0
  const canSave =
    Boolean(item.name?.trim()) && Boolean(item.section) &&
    item.price !== '' && item.price !== undefined && item.price !== null && Number.isFinite(Number(item.price))

  const toggleId = (field, list, id) =>
    onChange(field, list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle="Los cambios se ven en el menú al guardar"
      wide
      footer={
        <div className="flex items-center gap-3">
          {!canSave && <p className="hidden sm:block flex-1 text-xs text-light-200/70">Completa nombre, sección y precio.</p>}
          <button type="button" onClick={onClose} className={btnSecondary + ' sm:ml-auto flex-1 sm:flex-none'}>Cancelar</button>
          <button type="button" onClick={onSave} disabled={isSubmitting || !canSave} className={btnPrimary + ' flex-1 sm:flex-none sm:min-w-[170px]'}>
            {isSubmitting ? 'Guardando…' : 'Guardar producto'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Live preview — the exact card customers see */}
        <div className="customer-preview rounded-2xl bg-bg p-3 sm:p-4 ring-1 ring-white/10">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-soft">
            <Smartphone size={13} /> Así se verá en el menú
          </p>
          <ul className="pointer-events-none font-body text-ink sm:max-w-[290px] sm:mx-auto" aria-hidden="true">
            <MenuCard
              key={`${item.docId ?? 'new'}-${newImagePreview ?? ''}`}
              id={item.id ?? 'preview'}
              name={item.name?.trim() || 'Nombre del producto'}
              desc={item.desc}
              long_desc={item.long_desc}
              price={priceNumber}
              image={item.image}
              imageUrl={newImagePreview || item.imageUrl}
              isActive={item.isActive !== false}
              featured={item.featured || false}
              popular={item.popular || false}
              availableToppings={selectedToppings.map((t) => ({ id: t.docId, name: t.name, price: Number(t.price || 0) }))}
              optionGroups={optionGroups}
              tone={getSectionTone(sectionIndex)}
            />
          </ul>
        </div>

        <FormSection icon={Info} title="Información" hint="Lo que el cliente lee en la tarjeta del producto.">
          <Field label="Nombre" required htmlFor="p-name">
            <input id="p-name" className={inputCls} value={item.name || ''} onChange={(e) => onChange('name', e.target.value)} placeholder="Ej. Matcha Latte" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sección" required htmlFor="p-section">
              {menuSectionsLoading ? (
                <div className="h-11 rounded-xl bg-main-800 animate-pulse" />
              ) : (
                <select id="p-section" className={inputCls} value={item.section || ''} onChange={(e) => onChange('section', e.target.value)}>
                  <option value="">Elige una sección</option>
                  {menuSections.map((s) => (
                    <option key={s.docId ?? s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Precio" required htmlFor="p-price" hint="Precio base, sin extras.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-light-200/60">$</span>
                <input id="p-price" className={inputCls + ' pl-7 tabular-nums'} type="number" inputMode="decimal" min="0" step="0.5" value={item.price ?? ''} onChange={(e) => onChange('price', e.target.value)} placeholder="0" />
              </div>
            </Field>
          </div>
          <Field label="Descripción corta" htmlFor="p-desc" hint="Una línea bajo el nombre, ej. “Con tapioca”.">
            <input id="p-desc" className={inputCls} maxLength={60} value={item.desc || ''} onChange={(e) => onChange('desc', e.target.value)} />
          </Field>
          <Field label="Descripción completa" htmlFor="p-long" hint="Aparece cuando el cliente toca el botón ⓘ del producto.">
            <textarea id="p-long" className={textareaCls} rows={3} value={item.long_desc || ''} onChange={(e) => onChange('long_desc', e.target.value)} />
          </Field>
        </FormSection>

        <FormSection icon={ImagePlus} title="Foto">
          <ImagePicker
            key={item.docId ?? 'new'}
            currentSrc={productImageSrc(item)}
            onFile={(file) => {
              onImageChange(file)
              setNewImagePreview(file ? URL.createObjectURL(file) : null)
            }}
            hint="Foto horizontal con el producto al centro. Se sube al guardar."
          />
        </FormSection>

        <FormSection
          icon={SlidersHorizontal}
          title="Personalización"
          hint="Preguntas que el cliente responde al pedir (sabor, tamaño…) y extras con costo."
        >
          <OptionGroupsEditor groups={optionGroups} onChange={(groups) => onChange('optionGroups', groups)} />

          {toppingsList.length > 0 && (
            <Field label="Extras disponibles" hint="Se ofrecen después de elegir opciones. Los extras se crean en la pestaña Extras.">
              <div className="flex flex-wrap gap-2">
                {toppingsList.map((t) => {
                  const checked = (item.toppingIds || []).includes(t.docId)
                  return (
                    <ChipCheck key={t.docId} checked={checked} onChange={() => toggleId('toppingIds', item.toppingIds || [], t.docId)}>
                      {checked && <Check size={14} />} {t.name} <span className="opacity-75">+${t.price}</span>
                    </ChipCheck>
                  )
                })}
              </div>
            </Field>
          )}
        </FormSection>

        {stationTagOptions.length > 0 && (
          <FormSection icon={ChefHat} title="¿Quién lo prepara?" hint="Elige la estación que recibe este producto. Sin selección, el pedido le llega a Caja.">
            <div className="flex flex-wrap gap-2">
              {stationTagOptions.map((tag) => {
                const checked = (item.stationTags || []).includes(tag)
                return (
                  <ChipCheck key={tag} checked={checked} onChange={() => toggleId('stationTags', item.stationTags || [], tag)}>
                    {checked && <Check size={14} />} {tag}
                  </ChipCheck>
                )
              })}
            </div>
          </FormSection>
        )}

        <div className="rounded-2xl border border-white/10 bg-main-900 px-4 py-3.5">
          <Toggle
            checked={item.isActive !== false}
            onChange={(v) => onChange('isActive', v)}
            label="Disponible para vender"
            hint="Apágalo cuando se acabe: en el menú aparecerá como “Agotado”."
          />
        </div>

        {error && <Notice icon={AlertCircle}>{error}</Notice>}
      </div>
    </Drawer>
  )
}

// ── Section drawer ────────────────────────────────────────────────────────────
// "category" decides which customer page shows the section (/bebidas, /alimentos).
const SectionDrawer = ({ isOpen, onClose, title, item, onChange, onSave, isSubmitting, error, categoryOptions }) => {
  const current = (item.category || '').toLowerCase()
  const options = categoryOptions.includes(current) || !current ? categoryOptions : [...categoryOptions, current]
  const canSave = Boolean(item.name?.trim()) && Boolean(current)
  const renamed = item._originalName && item._originalName !== item.name
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className={btnSecondary + ' flex-1'}>Cancelar</button>
          <button type="button" onClick={onSave} disabled={isSubmitting || !canSave} className={btnPrimary + ' flex-1'}>
            {isSubmitting ? 'Guardando…' : 'Guardar sección'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormSection icon={Layers} title="Sección del menú" hint="Agrupa productos, por ejemplo “Bebidas Heladas” o “Panadería”.">
          <Field label="Nombre" required htmlFor="s-name" hint={renamed ? 'Al renombrarla, sus productos se mueven automáticamente.' : undefined}>
            <input id="s-name" className={inputCls} value={item.name || ''} onChange={(e) => onChange('name', e.target.value)} placeholder="Ej. Bebidas Heladas" />
          </Field>
          <Field label="¿En qué botón del menú aparece?" required hint="El menú tiene los botones “Bebidas” y “Alimentos”. La sección también sale siempre en “Todo”.">
            <Segmented
              ariaLabel="Categoría de la sección"
              value={current}
              onChange={(v) => onChange('category', v)}
              options={options.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
            />
          </Field>
          <Field label="Descripción" htmlFor="s-desc" hint="1–2 frases que invitan, ej. “Para refrescarte en cualquier momento del día.”">
            <textarea id="s-desc" className={textareaCls} rows={2} value={item.desc || ''} onChange={(e) => onChange('desc', e.target.value)} />
          </Field>
        </FormSection>
        <p className="px-1 text-xs text-light-200/70">Para cambiar el orden, arrastra las secciones en la lista (en computadora).</p>
        {error && <Notice icon={AlertCircle}>{error}</Notice>}
      </div>
    </Drawer>
  )
}

// ── Products tab ──────────────────────────────────────────────────────────────
const ProductsTab = ({ data, notify }) => {
  const {
    menuItems, menuLoading, menuError, menuSections, menuSectionsLoading,
    menuSectionsError, menuSavingId, toppingsList,
    handleSaveMenuItem, handleDeleteMenuItem, handleToggleProductActive,
    handleAddProduct, handleAddSection, handleSaveSection, handleDeleteSection,
    editingItem, setEditingItem, setEditingImageFile,
    deleteTarget, setDeleteTarget,
    editingSection, setEditingSection,
    deleteSectionTarget, setDeleteSectionTarget,
    isSubmitting, error, setError,
    productName, setProductName, productSection, setProductSection,
    productDesc, setProductDesc, productLongDesc, setProductLongDesc,
    productPrice, setProductPrice,
    productImage, setProductImage, setProductImageFile,
    productToppingIds, setProductToppingIds, productStationTags, setProductStationTags,
    productOptionGroups, productSuccess, setProductSuccess,
    sectionName, setSectionName, sectionCategory, setSectionCategory,
    sectionDesc, setSectionDesc,
    sectionSuccess, setSectionSuccess,
    loadMenuItems, loadMenuSections,
  } = data

  const [collapsedSections, setCollapsedSections] = useState({})
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [dragOverSection, setDragOverSection] = useState(null)
  const [search, setSearch] = useState('')
  const dragSectionRef = useRef(null)
  const pendingEditName = useRef(null)

  const { stations } = useStationContext()
  const stationTagOptions = useMemo(() => {
    const tags = new Set()
    stations.forEach((station) => {
      if (station.role === 'admin') return
      ;(station.productTags || []).forEach((tag) => tags.add(tag))
    })
    return Array.from(tags)
  }, [stations])

  // Category choices = the customer menu buttons (bebidas/alimentos) + any already in use
  const categoryOptions = useMemo(() => {
    const set = new Set(['bebidas', 'alimentos'])
    menuSections.forEach((s) => { if (s.category) set.add(String(s.category).toLowerCase()) })
    return Array.from(set)
  }, [menuSections])

  const openAddProduct = (sectionName = '') => {
    setError('')
    if (sectionName) setProductSection(sectionName)
    setAddProductOpen(true)
  }
  const openAddSection = () => { setError(''); setAddSectionOpen(true) }

  // Open drawer if navigated here with state (Inicio quick actions)
  const location = useLocation()
  useEffect(() => {
    if (location.state?.openAddProduct) {
      openAddProduct()
      window.history.replaceState({}, '')
    }
    if (location.state?.openAddSection) {
      openAddSection()
      window.history.replaceState({}, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  // Close the "add" drawers once the hook reports success
  useEffect(() => {
    if (productSuccess) { setAddProductOpen(false); notify('Producto agregado al menú'); setProductSuccess('') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSuccess])
  useEffect(() => {
    if (sectionSuccess) { setAddSectionOpen(false); notify('Sección creada'); setSectionSuccess('') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionSuccess])

  // The hook clears editingItem only when the save succeeded
  useEffect(() => {
    if (!editingItem && pendingEditName.current) {
      notify(`“${pendingEditName.current}” guardado`)
      pendingEditName.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingItem])

  const toggleSection = (name) =>
    setCollapsedSections(prev => ({ ...prev, [name]: !prev[name] }))

  // Group products by section preserving section order
  const grouped = menuSections.map(sec => ({
    section: sec,
    products: menuItems.filter(p => p.section === sec.name),
  }))
  // Products whose section no longer exists
  const ungroupedSections = [...new Set(menuItems.filter(p => !menuSections.find(s => s.name === p.section)).map(p => p.section))]
  ungroupedSections.forEach(name => {
    grouped.push({ section: { name: name || 'Sin sección', docId: null }, products: menuItems.filter(p => p.section === name) })
  })

  const q = search.trim().toLowerCase()
  const visibleGroups = q
    ? grouped
      .map(g => ({ ...g, products: g.products.filter(p => p.name?.toLowerCase().includes(q)) }))
      .filter(g => g.products.length > 0)
    : grouped

  const totalProducts = menuItems.length
  const soldOut = menuItems.filter(p => p.isActive === false).length

  // New product form state object for add drawer
  const newProductObj = {
    name: productName, section: productSection, desc: productDesc,
    long_desc: productLongDesc, price: productPrice,
    image: productImage, toppingIds: productToppingIds, stationTags: productStationTags,
    optionGroups: productOptionGroups || [],
    isActive: true,
  }

  const handleNewProductChange = (field, value) => {
    const setters = {
      name: setProductName, section: setProductSection, desc: setProductDesc,
      long_desc: setProductLongDesc, price: setProductPrice,
      image: setProductImage, toppingIds: setProductToppingIds, stationTags: setProductStationTags,
      optionGroups: data.setProductOptionGroups,
    }
    setters[field]?.(value)
  }

  const handleSaveNewProduct = () => handleAddProduct({ preventDefault: () => {} })

  const openEdit = (product) => {
    pendingEditName.current = null
    setEditingItem(product)
    setEditingImageFile(null)
  }
  const handleEditChange = (field, value) => {
    setEditingItem(prev => prev ? { ...prev, [field]: value } : prev)
  }
  const handleSaveEdit = () => {
    if (!editingItem) return
    pendingEditName.current = editingItem.name
    handleSaveMenuItem(editingItem)
  }
  const closeEdit = () => {
    pendingEditName.current = null
    setEditingItem(null)
  }

  const newSectionObj = { name: sectionName, category: sectionCategory, desc: sectionDesc }
  const handleNewSectionChange = (field, value) => {
    const setters = { name: setSectionName, category: setSectionCategory, desc: setSectionDesc }
    setters[field]?.(value)
  }
  const handleSaveNewSection = () => handleAddSection({ preventDefault: () => {} })

  // Section drag-and-drop reorder
  const handleSectionDragStart = (idx) => { dragSectionRef.current = idx }
  const handleSectionDragOver = (e, idx) => { e.preventDefault(); setDragOverSection(idx) }
  const handleSectionDrop = async (dropIdx) => {
    setDragOverSection(null)
    const fromIdx = dragSectionRef.current
    dragSectionRef.current = null
    if (fromIdx === null || fromIdx === dropIdx) return

    const docSections = grouped.filter(g => g.section.docId)
    if (fromIdx >= docSections.length || dropIdx >= docSections.length) return

    const reordered = [...docSections]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(dropIdx, 0, moved)

    try {
      const batch = writeBatch(db)
      reordered.forEach(({ section }, i) => {
        batch.update(doc(db, 'sections', section.docId), { order: i })
      })
      await batch.commit()
      loadMenuSections()
    } catch (err) {
      console.error('Error reordering sections:', err)
    }
  }

  const handleEditSectionChange = (field, value) => {
    setEditingSection(prev => prev ? { ...prev, [field]: value } : prev)
  }
  const handleSaveEditSection = () => {
    if (editingSection) handleSaveSection({ ...editingSection, originalName: editingSection._originalName ?? editingSection.name })
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-light-200/55" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            aria-label="Buscar producto"
            className={inputCls + ' pl-10'}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={openAddSection} className={btnSecondary + ' flex-1 sm:flex-none'}>
            <Layers size={16} /> <span className="sm:hidden">Sección</span><span className="hidden sm:inline">Nueva sección</span>
          </button>
          <button onClick={() => openAddProduct()} className={btnPrimary + ' flex-1 sm:flex-none'}>
            <Plus size={18} /> <span className="sm:hidden">Producto</span><span className="hidden sm:inline">Nuevo producto</span>
          </button>
          <button
            onClick={() => { loadMenuItems(); loadMenuSections() }}
            className={iconBtn + ' border border-white/15 bg-main-900 shrink-0'}
            aria-label="Recargar menú"
            title="Recargar"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      {!menuLoading && totalProducts > 0 && (
        <p className="text-sm text-light-200/75">
          {menuSections.length} secciones · {totalProducts} productos
          {soldOut > 0 && <> · <span className="font-bold text-rose-400">{soldOut} agotado{soldOut === 1 ? '' : 's'}</span></>}
          <span className="hidden sm:inline"> · Toca un producto para editarlo.</span>
        </p>
      )}

      {menuError && !editingItem && <Notice icon={AlertCircle}>{menuError}</Notice>}
      {menuSectionsError && !editingSection && <Notice icon={AlertCircle}>{menuSectionsError}</Notice>}

      {menuLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-main-900 animate-pulse" />)}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Tu menú está vacío"
          action={<button onClick={openAddSection} className={btnPrimary}><Plus size={16} /> Crear primera sección</button>}
        >
          Primero crea una sección (por ejemplo “Bebidas Heladas”) y luego agrega sus productos.
        </EmptyState>
      ) : visibleGroups.length === 0 ? (
        <EmptyState icon={Search} title="Sin resultados">No hay productos que coincidan con “{search}”.</EmptyState>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map(({ section, products }, idx) => {
            const isCollapsed = !q && collapsedSections[section.name]
            const isHidden = section.visible === false
            const canDrag = Boolean(section.docId) && !q
            return (
              <div
                key={section.docId ?? section.name}
                className={`rounded-2xl border bg-main-900 overflow-hidden transition-colors ${dragOverSection === idx ? 'border-primary ring-2 ring-primary/15' : 'border-white/10'}`}
                draggable={canDrag}
                onDragStart={() => handleSectionDragStart(idx)}
                onDragOver={(e) => canDrag && handleSectionDragOver(e, idx)}
                onDrop={() => canDrag && handleSectionDrop(idx)}
                onDragLeave={() => setDragOverSection(null)}
              >
                {/* Section header */}
                <div className="flex items-center gap-1 sm:gap-2 pl-2 pr-2 py-1.5 border-b border-white/10 bg-main-800/60">
                  <span className={`hidden sm:flex h-10 w-6 items-center justify-center ${canDrag ? 'text-light-200/55 cursor-grab' : 'text-light-200/25'}`} title={canDrag ? 'Arrastra para reordenar' : undefined}>
                    <GripVertical size={16} />
                  </span>
                  <button onClick={() => toggleSection(section.name)} className="flex min-h-[44px] flex-1 min-w-0 items-center gap-2 px-1 text-left cursor-pointer" aria-expanded={!isCollapsed}>
                    <ChevronDown size={18} className={`shrink-0 text-light-200/60 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    <span className="font-display text-lg font-semibold text-light-100 truncate">{section.name}</span>
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-light-200/80">{products.length}</span>
                    {section.category && <span className="hidden sm:inline shrink-0 text-xs font-semibold text-light-200/60 capitalize">· {section.category}</span>}
                    {isHidden && <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-400">Oculta</span>}
                  </button>
                  {section.docId && (
                    <div className="flex items-center shrink-0">
                      <button
                        onClick={() => data.handleToggleSectionVisible(section)}
                        disabled={menuSavingId === section.docId}
                        className={iconBtn}
                        aria-label={isHidden ? `Mostrar sección ${section.name}` : `Ocultar sección ${section.name}`}
                        title={isHidden ? 'Mostrar en el menú' : 'Ocultar del menú'}
                      >
                        {isHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <button onClick={() => setEditingSection({ ...section, _originalName: section.name })} className={iconBtn} aria-label={`Editar sección ${section.name}`} title="Editar sección">
                        <Pencil size={17} />
                      </button>
                      <button onClick={() => setDeleteSectionTarget(section)} className={iconBtnDanger} aria-label={`Eliminar sección ${section.name}`} title="Eliminar sección">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Products */}
                {!isCollapsed && (
                  <div className="divide-y divide-white/10">
                    {products.map(product => {
                      const groups = Array.isArray(product.optionGroups) ? product.optionGroups.length : 0
                      const extras = Array.isArray(product.toppingIds) ? product.toppingIds.length : 0
                      const active = product.isActive !== false
                      return (
                        <div
                          key={product.docId}
                          className="flex items-center gap-3 pl-3 sm:pl-4 pr-2 py-2.5 hover:bg-white/5 transition-colors cursor-pointer"
                          onClick={() => openEdit(product)}
                        >
                          <Thumb src={productImageSrc(product)} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-[0.95rem] font-bold truncate ${active ? 'text-light-100' : 'text-light-200/60'}`}>{product.name}</p>
                            <p className="text-xs text-light-200/75 truncate">
                              <span className="font-bold tabular-nums text-light-100">${Number(product.price).toLocaleString('es-MX')}</span>
                              {groups > 0 && <> · {groups} pregunta{groups === 1 ? '' : 's'}</>}
                              {extras > 0 && <> · {extras} extra{extras === 1 ? '' : 's'}</>}
                              {!active && <> · <span className="font-bold text-rose-400">Agotado</span></>}
                            </p>
                          </div>
                          <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                            <MiniSwitch
                              checked={active}
                              onChange={() => handleToggleProductActive(product)}
                              disabled={menuSavingId === product.docId}
                              label={active ? `${product.name}: disponible (tocar para marcar agotado)` : `${product.name}: agotado (tocar para marcar disponible)`}
                            />
                            <button onClick={() => openEdit(product)} className={iconBtn.replace('inline-flex', 'hidden sm:inline-flex')} aria-label={`Editar ${product.name}`}>
                              <Pencil size={17} />
                            </button>
                            <button onClick={() => setDeleteTarget(product)} className={iconBtnDanger} aria-label={`Eliminar ${product.name}`}>
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {section.docId && !q && (
                      <button
                        onClick={() => openAddProduct(section.name)}
                        className="flex w-full min-h-[48px] items-center gap-2 px-4 text-sm font-bold text-primary dark:text-main-300 hover:bg-primary/5 transition-colors cursor-pointer"
                      >
                        <Plus size={16} /> Agregar producto a {section.name}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add product */}
      <ProductDrawer
        isOpen={addProductOpen}
        onClose={() => setAddProductOpen(false)}
        title="Nuevo producto"
        item={newProductObj}
        onChange={handleNewProductChange}
        onSave={handleSaveNewProduct}
        onImageChange={setProductImageFile}
        isSubmitting={isSubmitting}
        error={error}
        menuSections={menuSections}
        menuSectionsLoading={menuSectionsLoading}
        toppingsList={toppingsList}
        stationTagOptions={stationTagOptions}
      />

      {/* Edit product */}
      <ProductDrawer
        isOpen={Boolean(editingItem)}
        onClose={closeEdit}
        title="Editar producto"
        item={editingItem ?? {}}
        onChange={handleEditChange}
        onSave={handleSaveEdit}
        onImageChange={setEditingImageFile}
        isSubmitting={menuSavingId === editingItem?.docId}
        error={menuError}
        menuSections={menuSections}
        menuSectionsLoading={menuSectionsLoading}
        toppingsList={toppingsList}
        stationTagOptions={stationTagOptions}
      />

      {/* Add section */}
      <SectionDrawer
        isOpen={addSectionOpen}
        onClose={() => setAddSectionOpen(false)}
        title="Nueva sección"
        item={newSectionObj}
        onChange={handleNewSectionChange}
        onSave={handleSaveNewSection}
        isSubmitting={isSubmitting}
        error={error}
        categoryOptions={categoryOptions}
      />

      {/* Edit section */}
      <SectionDrawer
        isOpen={Boolean(editingSection)}
        onClose={() => setEditingSection(null)}
        title="Editar sección"
        item={editingSection ?? {}}
        onChange={handleEditSectionChange}
        onSave={handleSaveEditSection}
        isSubmitting={menuSavingId === editingSection?.docId}
        error={menuSectionsError}
        categoryOptions={categoryOptions}
      />

      {deleteTarget && (
        <ConfirmDialog
          message={`¿Eliminar “${deleteTarget.name}”? Desaparecerá del menú y no se puede deshacer. Si solo se acabó, mejor márcalo como agotado con el interruptor.`}
          isPending={menuSavingId === deleteTarget.docId}
          onConfirm={async () => { await handleDeleteMenuItem(deleteTarget); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteSectionTarget && (
        <ConfirmDialog
          message={`¿Eliminar la sección “${deleteSectionTarget.name}” y TODOS sus productos? No se puede deshacer. Para quitarla solo por un tiempo, ocúltala con el ojo.`}
          isPending={menuSavingId === deleteSectionTarget.docId}
          onConfirm={() => handleDeleteSection(deleteSectionTarget)}
          onCancel={() => setDeleteSectionTarget(null)}
        />
      )}
    </div>
  )
}

// ── Extras (toppings) tab ─────────────────────────────────────────────────────
const ToppingsTab = ({ data }) => {
  const {
    toppingsList, toppingsLoading, toppingsError, toppingsSuccess,
    toppingName, setToppingName, toppingPrice, setToppingPrice,
    toppingDescription, setToppingDescription,
    handleAddTopping, handleSaveTopping, handleDeleteTopping,
    editingTopping, setEditingTopping,
    deleteToppingTarget, setDeleteToppingTarget,
    isSubmitting,
  } = data

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      {/* Add form */}
      <form onSubmit={handleAddTopping} className="lg:sticky lg:top-0">
        <FormSection icon={Candy} title="Nuevo extra" hint="Algo que se cobra aparte: tapioca extra, cloud top, shot de café… Después actívalo en cada producto.">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Nombre" required htmlFor="t-name">
              <input id="t-name" className={inputCls} value={toppingName} onChange={e => setToppingName(e.target.value)} placeholder="Ej. Tapioca extra" required />
            </Field>
            <Field label="Precio" required htmlFor="t-price">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-light-200/60">+$</span>
                <input id="t-price" className={inputCls + ' pl-8 tabular-nums'} type="number" inputMode="decimal" min="0" step="0.5" value={toppingPrice} onChange={e => setToppingPrice(e.target.value)} required />
              </div>
            </Field>
          </div>
          <Field label="Descripción" htmlFor="t-desc" hint="Opcional. El cliente la ve al tocar ⓘ junto al extra.">
            <textarea id="t-desc" className={textareaCls} rows={2} value={toppingDescription} onChange={e => setToppingDescription(e.target.value)} />
          </Field>
          {toppingsError && <Notice icon={AlertCircle}>{toppingsError}</Notice>}
          {toppingsSuccess && <Notice tone="success" icon={Check}>{toppingsSuccess}</Notice>}
          <button type="submit" disabled={isSubmitting} className={btnPrimary + ' w-full'}>
            <Plus size={16} /> Agregar extra
          </button>
        </FormSection>
      </form>

      {/* List */}
      <div className="rounded-2xl border border-white/10 bg-main-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 bg-main-800/60">
          <h3 className="font-display text-lg font-semibold">Extras ({toppingsList.length})</h3>
        </div>
        {toppingsLoading ? (
          <div className="p-8 text-center text-sm text-light-200/70">Cargando…</div>
        ) : toppingsList.length === 0 ? (
          <div className="p-6"><EmptyState icon={Candy} title="Aún no hay extras">Crea el primero con el formulario.</EmptyState></div>
        ) : (
          <div className="divide-y divide-white/10">
            {toppingsList.map(t => (
              <div key={t.docId} className="px-4 py-3">
                {editingTopping?.docId === t.docId ? (
                  <form onSubmit={e => { e.preventDefault(); handleSaveTopping(editingTopping) }} className="space-y-2">
                    <div className="flex gap-2">
                      <input className={inputCls + ' flex-1'} aria-label="Nombre" value={editingTopping.name} onChange={e => setEditingTopping(prev => ({ ...prev, name: e.target.value }))} autoFocus />
                      <input className={inputCls + ' w-24 tabular-nums'} aria-label="Precio" type="number" min="0" step="0.5" value={editingTopping.price} onChange={e => setEditingTopping(prev => ({ ...prev, price: e.target.value }))} />
                    </div>
                    <textarea
                      className={textareaCls}
                      rows={2}
                      placeholder="Descripción (opcional)"
                      aria-label="Descripción"
                      value={editingTopping.description || ''}
                      onChange={e => setEditingTopping(prev => ({ ...prev, description: e.target.value }))}
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingTopping(null)} className={btnSecondary}>Cancelar</button>
                      <button type="submit" className={btnPrimary}><Check size={16} /> Guardar</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.95rem] font-bold text-light-100">
                        {t.name} <span className="ml-1 text-sm font-bold text-primary dark:text-main-300 tabular-nums">+${t.price}</span>
                      </p>
                      {t.description && <p className="text-xs text-light-200/75 mt-0.5 leading-snug">{t.description}</p>}
                    </div>
                    <button onClick={() => setEditingTopping(t)} className={iconBtn} aria-label={`Editar ${t.name}`}><Pencil size={17} /></button>
                    <button onClick={() => setDeleteToppingTarget(t)} className={iconBtnDanger} aria-label={`Eliminar ${t.name}`}><Trash2 size={17} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteToppingTarget && (
        <ConfirmDialog
          message={`¿Eliminar el extra “${deleteToppingTarget.name}”? Dejará de ofrecerse en todos los productos.`}
          isPending={false}
          onConfirm={() => handleDeleteTopping(deleteToppingTarget)}
          onCancel={() => setDeleteToppingTarget(null)}
        />
      )}
    </div>
  )
}

// ── Carousel tab ──────────────────────────────────────────────────────────────
// Product <select> grouped by section.
const LinkedProductSelect = ({ id, value, onChange, products, loading }) => {
  const bySection = useMemo(() => {
    const map = new Map()
    products.forEach((p) => {
      const key = p.section || 'Sin sección'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    })
    return Array.from(map.entries())
  }, [products])
  if (loading) return <div className="h-11 rounded-xl bg-main-800 animate-pulse" />
  return (
    <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value, products.find((p) => p.docId === e.target.value))}>
      <option value="">Elige el producto que se agrega al tocar</option>
      {bySection.map(([section, list]) => (
        <optgroup key={section} label={section}>
          {list.map((p) => <option key={p.docId} value={p.docId}>{p.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

// Products in a "Combos" section are stored with linkType "combo" (same as before).
const isComboSection = (section = '') => ['combos', 'combo'].includes(String(section).toLowerCase())

const CarouselTab = ({ data }) => {
  const {
    carouselSlides, carouselLoading, carouselError, carouselSuccess,
    carouselLinkedId, setCarouselLinkedId, setCarouselLinkType,
    carouselActive, setCarouselActive,
    setCarouselImageFile,
    carouselProducts, carouselItemsLoading,
    handleAddCarouselSlide, handleSaveCarouselSlide, handleDeleteCarouselSlide,
    handleToggleSlideActive, handleSlideReorder,
    editingSlide, setEditingSlide, setEditingSlideImageFile,
    deleteSlideTarget, setDeleteSlideTarget,
    isSubmitting,
  } = data

  const [formKey, setFormKey] = useState(0)
  const productName = (pid) => carouselProducts.find((p) => p.docId === pid)?.name

  // Reset the image picker after a successful add
  useEffect(() => { if (carouselSuccess) setFormKey((k) => k + 1) }, [carouselSuccess])

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      {/* Add slide */}
      <form onSubmit={handleAddCarouselSlide} className="lg:sticky lg:top-0">
        <FormSection icon={MonitorPlay} title="Nueva promoción en carrusel" hint="Aparece arriba del menú. Al tocarla, el cliente agrega el producto vinculado.">
          <Field label="Imagen" required hint="Usa la misma imagen de tu historia de Instagram (vertical 9:16).">
            <ImagePicker key={formKey} aspect="aspect-[9/16]" onFile={setCarouselImageFile} />
          </Field>
          <Field label="Producto vinculado" required htmlFor="c-linked">
            <LinkedProductSelect
              id="c-linked"
              value={carouselLinkedId}
              products={carouselProducts}
              loading={carouselItemsLoading}
              onChange={(pid, p) => { setCarouselLinkedId(pid); setCarouselLinkType(isComboSection(p?.section) ? 'combo' : 'product') }}
            />
          </Field>
          <div className="rounded-xl bg-main-800 px-3 py-2">
            <Toggle checked={carouselActive} onChange={setCarouselActive} label="Publicar de inmediato" hint="Si lo apagas, se guarda oculta." />
          </div>
          {carouselError && <Notice icon={AlertCircle}>{carouselError}</Notice>}
          {carouselSuccess && <Notice tone="success" icon={Check}>{carouselSuccess}</Notice>}
          <button type="submit" disabled={isSubmitting} className={btnPrimary + ' w-full'}>
            {isSubmitting ? 'Subiendo…' : <><Plus size={16} /> Agregar al carrusel</>}
          </button>
        </FormSection>
      </form>

      {/* Slides */}
      <div className="rounded-2xl border border-white/10 bg-main-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 bg-main-800/60">
          <h3 className="font-display text-lg font-semibold">En el carrusel ({carouselSlides.length})</h3>
          <p className="text-xs text-light-200/70">Se muestran en este orden. Usa las flechas para moverlas.</p>
        </div>
        {carouselLoading && carouselSlides.length === 0 ? (
          <div className="p-8 text-center text-sm text-light-200/70">Cargando…</div>
        ) : carouselSlides.length === 0 ? (
          <div className="p-6"><EmptyState icon={MonitorPlay} title="El carrusel está vacío">Agrega tu primera promoción con el formulario.</EmptyState></div>
        ) : (
          <div className="divide-y divide-white/10">
            {carouselSlides.map((slide, idx) => {
              const active = slide.active === true || slide.isActive === true
              const linkedName = productName(slide.linkedId)
              return (
                <div key={slide.id} className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-3">
                  <div className="flex flex-col">
                    <button onClick={() => handleSlideReorder(idx, idx - 1)} disabled={idx === 0} className={iconBtn.replace('h-10', 'h-9')} aria-label="Mover arriba"><ArrowUp size={16} /></button>
                    <button onClick={() => handleSlideReorder(idx, idx + 1)} disabled={idx === carouselSlides.length - 1} className={iconBtn.replace('h-10', 'h-9')} aria-label="Mover abajo"><ArrowDown size={16} /></button>
                  </div>
                  <div className="h-24 aspect-[9/16] shrink-0 overflow-hidden rounded-xl bg-main-800">
                    {slide.imageUrl && <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.95rem] font-bold text-light-100 truncate">{linkedName || slide.altText || `Promoción ${idx + 1}`}</p>
                    <p className={`text-xs font-bold mt-0.5 ${active ? 'text-emerald-400' : 'text-light-200/60'}`}>{active ? 'Visible en el menú' : 'Oculta'}</p>
                    {!linkedName && !carouselItemsLoading && (
                      <p className="text-xs font-semibold text-amber-400 mt-0.5">El producto vinculado ya no existe</p>
                    )}
                  </div>
                  <div className="flex items-center shrink-0">
                    <MiniSwitch checked={active} onChange={() => handleToggleSlideActive(slide)} label={active ? 'Ocultar del menú' : 'Mostrar en el menú'} />
                    <button onClick={() => { setEditingSlide(slide); setEditingSlideImageFile(null) }} className={iconBtn} aria-label="Editar promoción"><Pencil size={17} /></button>
                    <button onClick={() => setDeleteSlideTarget(slide)} className={iconBtnDanger} aria-label="Quitar promoción"><Trash2 size={17} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit slide */}
      {editingSlide && (
        <Drawer
          isOpen={Boolean(editingSlide)}
          onClose={() => setEditingSlide(null)}
          title="Editar promoción"
          footer={
            <div className="flex gap-3">
              <button onClick={() => setEditingSlide(null)} className={btnSecondary + ' flex-1'}>Cancelar</button>
              <button
                onClick={() => handleSaveCarouselSlide({
                  ...editingSlide,
                  altText: productName(editingSlide.linkedId) || editingSlide.altText || '',
                })}
                disabled={!editingSlide.linkedId}
                className={btnPrimary + ' flex-1'}
              >
                Guardar
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormSection icon={MonitorPlay} title="Promoción">
              <Field label="Imagen" hint="Vertical 9:16, igual que tu historia de Instagram.">
                <ImagePicker key={editingSlide.id} aspect="aspect-[9/16]" currentSrc={editingSlide.imageUrl} onFile={setEditingSlideImageFile} />
              </Field>
              <Field label="Producto vinculado" required htmlFor="c-edit-linked">
                <LinkedProductSelect
                  id="c-edit-linked"
                  value={editingSlide.linkedId || ''}
                  products={carouselProducts}
                  loading={carouselItemsLoading}
                  onChange={(pid, p) => setEditingSlide(prev => ({ ...prev, linkedId: pid, linkType: isComboSection(p?.section) ? 'combo' : 'product' }))}
                />
              </Field>
              <div className="rounded-xl bg-main-800 px-3 py-2">
                <Toggle
                  checked={editingSlide.active ?? true}
                  onChange={(v) => setEditingSlide(prev => ({ ...prev, active: v }))}
                  label="Visible en el menú"
                />
              </div>
            </FormSection>
            {carouselError && <Notice icon={AlertCircle}>{carouselError}</Notice>}
          </div>
        </Drawer>
      )}

      {deleteSlideTarget && (
        <ConfirmDialog
          message={`¿Quitar “${productName(deleteSlideTarget.linkedId) || deleteSlideTarget.altText || 'esta promoción'}” del carrusel?`}
          isPending={carouselLoading}
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
  { id: 'toppings', label: 'Extras', icon: Candy },
  { id: 'carousel', label: 'Carrusel', icon: MonitorPlay },
  { id: 'builder', label: 'Arma tu bebida', icon: CupSoda },
]

export const MenuEditor = () => {
  const data = useAdminData()
  const location = useLocation()

  const [activeTab, setActiveTab] = useState(location.state?.tab ?? 'products')
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const notify = (msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

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
    <div className="space-y-5">
      {/* Tabs */}
      <div role="tablist" aria-label="Partes del menú" className="flex w-full max-w-full sm:inline-flex sm:w-auto gap-1 overflow-x-auto scrollbar-hide rounded-2xl bg-main-900 p-1.5 ring-1 ring-white/10">
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={(e) => {
                setActiveTab(tab.id)
                e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
              }}
              className={`flex flex-1 shrink-0 sm:flex-none min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors cursor-pointer ${
                active ? 'bg-primary text-snow shadow-sm' : 'text-light-200/75 hover:bg-white/5 hover:text-light-100'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'products' && <ProductsTab data={data} notify={notify} />}
      {activeTab === 'toppings' && <ToppingsTab data={data} />}
      {activeTab === 'carousel' && <CarouselTab data={data} />}
      {activeTab === 'builder' && <DrinkBuilderEditor notify={notify} />}

      {toast && (
        <div role="status" aria-live="polite" className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-[80] flex items-center gap-2 rounded-full bg-light-100 px-5 py-3 text-sm font-bold text-main-900 shadow-2xl">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  )
}
