import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router'
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { uploadToCloudinary } from '../utils/cloudinary'

export const Admin = () => {
  // Simple allowlist for admin access.
  const ALLOWED_EMAILS = ['jethrosiloe26@gmail.com']
  // Auth/session state.
  const [user, setUser] = useState(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Product form state.
  const [productName, setProductName] = useState('')
  const [productSection, setProductSection] = useState('')
  const [productDesc, setProductDesc] = useState('')
  const [productLongDesc, setProductLongDesc] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productFlavors, setProductFlavors] = useState('')
  const [productImage, setProductImage] = useState('')
  const [productImageFile, setProductImageFile] = useState(null)
  const [productSuccess, setProductSuccess] = useState('')
  // Section form state.
  const [sectionName, setSectionName] = useState('')
  const [sectionDesc, setSectionDesc] = useState('')
  const [sectionCategory, setSectionCategory] = useState('')
  const [sectionOrder, setSectionOrder] = useState('')
  const [sectionImage, setSectionImage] = useState('')
  const [sectionSuccess, setSectionSuccess] = useState('')
  const [isProductFormOpen, setIsProductFormOpen] = useState(false)
  const [isSectionFormOpen, setIsSectionFormOpen] = useState(false)
  const [isMenuEditOpen, setIsMenuEditOpen] = useState(true)
  const [menuItems, setMenuItems] = useState([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState('')
  const [menuSavingId, setMenuSavingId] = useState(null)
  const [isMenuEditorOpen, setIsMenuEditorOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editingImageFile, setEditingImageFile] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [menuSections, setMenuSections] = useState([])
  const [menuSectionsLoading, setMenuSectionsLoading] = useState(false)
  const [menuSectionsError, setMenuSectionsError] = useState('')
  const [isSectionEditorOpen, setIsSectionEditorOpen] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [deleteSectionTarget, setDeleteSectionTarget] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')
  const [stats, setStats] = useState({
    ordersToday: 0,
    totalRevenue: 0,
    avgTicket: 0,
  })
  const [recentOrders, setRecentOrders] = useState([])
  const [showAllOrders, setShowAllOrders] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState(new Set())
  const [isPromoFormOpen, setIsPromoFormOpen] = useState(false)
  const [promoTitle, setPromoTitle] = useState('')
  const [promoMessage, setPromoMessage] = useState('')
  const [promoSuccess, setPromoSuccess] = useState('')
  const [promoError, setPromoError] = useState('')
  const [activePromos, setActivePromos] = useState([])
  const [promoListLoading, setPromoListLoading] = useState(false)
  const [promoListError, setPromoListError] = useState('')
  // Carousel state.
  const [isCarouselOpen, setIsCarouselOpen] = useState(false)
  const [carouselSlides, setCarouselSlides] = useState([])
  const [carouselLoading, setCarouselLoading] = useState(false)
  const [carouselError, setCarouselError] = useState('')
  const [carouselSuccess, setCarouselSuccess] = useState('')
  // New-slide form fields
  const [carouselAltText, setCarouselAltText] = useState('')
  const [carouselLinkType, setCarouselLinkType] = useState('product')
  const [carouselLinkedId, setCarouselLinkedId] = useState('')
  const [carouselOrder, setCarouselOrder] = useState('')
  const [carouselActive, setCarouselActive] = useState(true)
  const [carouselImageFile, setCarouselImageFile] = useState(null)
  // Linked-item lists for dropdown
  const [carouselProducts, setCarouselProducts] = useState([])
  const [carouselCombos, setCarouselCombos] = useState([])
  const [carouselItemsLoading, setCarouselItemsLoading] = useState(false)
  // Drag-and-drop
  const dragSlideIdxRef = React.useRef(null)
  // Edit / delete
  const [editingSlide, setEditingSlide] = useState(null)
  const [editingSlideImageFile, setEditingSlideImageFile] = useState(null)
  const [deleteSlideTarget, setDeleteSlideTarget] = useState(null)
  // Toppings state.
  const [isToppingsOpen, setIsToppingsOpen] = useState(false)
  const [toppingsList, setToppingsList] = useState([])
  const [toppingsLoading, setToppingsLoading] = useState(false)
  const [toppingsError, setToppingsError] = useState('')
  const [toppingsSuccess, setToppingsSuccess] = useState('')
  const [toppingName, setToppingName] = useState('')
  const [toppingPrice, setToppingPrice] = useState('')
  const [editingTopping, setEditingTopping] = useState(null)
  const [deleteToppingTarget, setDeleteToppingTarget] = useState(null)
  // Product form: selected topping IDs.
  const [productToppingIds, setProductToppingIds] = useState([])

  const googleProvider = useMemo(() => new GoogleAuthProvider(), [])

  // Email-based admin gate (case-insensitive).
  const isAllowedEmail = (email) =>
    Boolean(email) &&
    ALLOWED_EMAILS.map((item) => item.toLowerCase()).includes(email.toLowerCase())

  useEffect(() => {
    // Keep auth state in sync and block non-admin users.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && !isAllowedEmail(currentUser.email)) {
        setError('Tu cuenta no tiene acceso al panel.')
        signOut(auth)
        setUser(null)
        setIsAuthReady(true)
        return
      }

      setUser(currentUser)
      setIsAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    let isActive = true

    const loadDashboardStats = async () => {
      setStatsLoading(true)
      setStatsError('')
      try {
        const ordersSnap = await getDocs(collection(db, 'orders'))
        const orders = ordersSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        const ordersSorted = orders.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime?.() ?? 0
          const bTime = b.createdAt?.toDate?.()?.getTime?.() ?? 0
          return bTime - aTime
        })

        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const startMs = startOfDay.getTime()

        let ordersToday = 0
        let totalRevenue = 0

        orders.forEach((order) => {
          const total = Number(order.total || 0)
          totalRevenue += total
          const createdAt = order.createdAt?.toDate?.()
          if (createdAt && createdAt.getTime() >= startMs) {
            ordersToday += 1
          }
        })

        const avgTicket =
          orders.length > 0 ? Number((totalRevenue / orders.length).toFixed(2)) : 0

        if (!isActive) return
        setRecentOrders(ordersSorted.slice(0, 50))
        setStats({
          ordersToday,
          totalRevenue,
          avgTicket,
        })
      } catch (err) {
        if (isActive) {
          setStatsError('No se pudieron cargar los datos del panel.')
        }
      } finally {
        if (isActive) {
          setStatsLoading(false)
        }
      }
    }

    loadDashboardStats()

    return () => {
      isActive = false
    }
  }, [user])

  const isAuthenticated = useMemo(() => Boolean(user), [user])

  // Email/password login.
  const handleLogin = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      setPassword('')
    } catch (err) {
      setError('No se pudo iniciar sesión. Revisa tu correo y contraseña.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Google sign-in with allowlist enforcement.
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const result = await signInWithPopup(auth, googleProvider)
      if (!isAllowedEmail(result.user?.email)) {
        setError('Tu cuenta no tiene acceso al panel.')
        await signOut(auth)
      }
    } catch (err) {
      setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Admin logout.
  const handleLogout = async () => {
    await signOut(auth)
  }

  // Loads the full product list for the menu editor.
  const loadMenuItems = async () => {
    setMenuLoading(true)
    setMenuError('')
    try {
      const snapshot = await getDocs(collection(db, 'products'))
      const items = snapshot.docs
        .map((docSnap) => ({
          docId: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => {
          const sectionCompare = String(a.section || '').localeCompare(
            String(b.section || '')
          )
          if (sectionCompare !== 0) return sectionCompare
          return String(a.name || '').localeCompare(String(b.name || ''))
        })
        .map((item) => ({
          ...item,
          price: item.price ?? '',
          flavorsText: Array.isArray(item.flavors)
            ? item.flavors.join(', ')
            : '',
        }))

      // Also ensure toppingIds is always loaded for the editor.
      setMenuItems(items.map((it) => ({ ...it, toppingIds: Array.isArray(it.toppingIds) ? it.toppingIds : [] })))
    } catch (err) {
      setMenuError('No se pudo cargar el menú.')
    } finally {
      setMenuLoading(false)
    }
  }

  const loadMenuSections = async () => {
    setMenuSectionsLoading(true)
    setMenuSectionsError('')
    try {
      const snapshot = await getDocs(collection(db, 'sections'))
      const items = snapshot.docs
        .map((docSnap) => ({
          docId: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setMenuSections(items)
    } catch (err) {
      setMenuSectionsError('No se pudieron cargar las secciones.')
    } finally {
      setMenuSectionsLoading(false)
    }
  }

  const deleteProductsBySection = async (sectionName) => {
    const productsQuery = query(
      collection(db, 'products'),
      where('section', '==', sectionName)
    )
    const snapshot = await getDocs(productsQuery)
    const docs = snapshot.docs
    const batchSize = 400

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db)
      docs.slice(i, i + batchSize).forEach((docSnap) => {
        batch.delete(doc(db, 'products', docSnap.id))
      })
      await batch.commit()
    }
  }

  const handleSaveSection = async (section) => {
    if (!section?.docId) return
    setMenuSavingId(section.docId)
    setMenuSectionsError('')

    try {
      const trimmedName = section.name?.trim?.() ?? ''
      const trimmedCategory = section.category?.trim?.() ?? ''
      const orderValue =
        section.order === '' || section.order === null || section.order === undefined
          ? 0
          : Number(section.order)

      if (!trimmedName || !trimmedCategory || !Number.isFinite(orderValue)) {
        setMenuSectionsError('Nombre, categoría y orden válido son obligatorios.')
        return
      }

      const previousName = section.originalName ?? section.name

      await updateDoc(doc(db, 'sections', section.docId), {
        name: trimmedName,
        desc: section.desc?.trim?.() ?? '',
        category: trimmedCategory,
        order: orderValue,
        image: section.image?.trim?.() ?? '',
      })

      if (previousName && previousName !== trimmedName) {
        const productsQuery = query(
          collection(db, 'products'),
          where('section', '==', previousName)
        )
        const snapshot = await getDocs(productsQuery)
        const docs = snapshot.docs
        const batchSize = 400

        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = writeBatch(db)
          docs.slice(i, i + batchSize).forEach((docSnap) => {
            batch.update(doc(db, 'products', docSnap.id), {
              section: trimmedName,
            })
          })
          await batch.commit()
        }

        setMenuItems((prev) =>
          prev.map((item) =>
            item.section === previousName ? { ...item, section: trimmedName } : item
          )
        )
      }

      setMenuSections((prev) =>
        prev.map((entry) =>
          entry.docId === section.docId
            ? { ...entry, ...section, name: trimmedName, category: trimmedCategory }
            : entry
        )
      )
      setEditingSection(null)
      setIsSectionEditorOpen(false)
    } catch (err) {
      setMenuSectionsError('No se pudo actualizar la sección.')
    } finally {
      setMenuSavingId(null)
    }
  }

  const handleDeleteSection = async (section) => {
    if (!section?.docId) return
    setMenuSavingId(section.docId)
    setMenuSectionsError('')
    try {
      await deleteProductsBySection(section.name)
      await deleteDoc(doc(db, 'sections', section.docId))
      setMenuSections((prev) => prev.filter((entry) => entry.docId !== section.docId))
      setMenuItems((prev) => prev.filter((item) => item.section !== section.name))
    } catch (err) {
      setMenuSectionsError('No se pudo eliminar la sección.')
    } finally {
      setMenuSavingId(null)
    }
  }

  const loadActivePromotions = async () => {
    setPromoListLoading(true)
    setPromoListError('')
    try {
      const snapshot = await getDocs(
        query(collection(db, 'promotions'), where('isActive', '==', true))
      )
      const promos = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      setActivePromos(promos)
    } catch (err) {
      setPromoListError('No se pudieron cargar las promociones activas.')
    } finally {
      setPromoListLoading(false)
    }
  }

  const handleDeactivatePromotion = async (promo) => {
    if (!promo?.id) return
    setPromoListLoading(true)
    setPromoListError('')
    try {
      await updateDoc(doc(db, 'promotions', promo.id), { isActive: false })
      setActivePromos((prev) => prev.filter((item) => item.id !== promo.id))
    } catch (err) {
      setPromoListError('No se pudo desactivar la promoción.')
    } finally {
      setPromoListLoading(false)
    }
  }

  // Creates a new active promotion and deactivates previous ones.
  const handleCreatePromotion = async (event) => {
    event.preventDefault()
    setPromoError('')
    setPromoSuccess('')

    const trimmedTitle = promoTitle.trim()
    if (!trimmedTitle) {
      setPromoError('La promoción necesita un título.')
      return
    }

    setIsSubmitting(true)
    try {
      const activePromos = await getDocs(
        query(collection(db, 'promotions'), where('isActive', '==', true))
      )

      if (!activePromos.empty) {
        const batch = writeBatch(db)
        activePromos.docs.forEach((docSnap) => {
          batch.update(doc(db, 'promotions', docSnap.id), { isActive: false })
        })
        await batch.commit()
      }

      await addDoc(collection(db, 'promotions'), {
        title: trimmedTitle,
        message: promoMessage.trim(),
        isActive: true,
        createdAt: serverTimestamp(),
      })

      setPromoTitle('')
      setPromoMessage('')
      setPromoSuccess('Promoción activada.')
      loadActivePromotions()
    } catch (err) {
      setPromoError('No se pudo activar la promoción.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Updates a single product in Firestore from the local editor state.
  const handleSaveMenuItem = async (item) => {
    if (!item?.docId) return
    setMenuSavingId(item.docId)
    setMenuError('')

    try {
      const priceValue = Number(item.price)
      if (!item.name?.trim() || !item.section?.trim() || !Number.isFinite(priceValue)) {
        setMenuError('Nombre, sección y precio son obligatorios.')
        return
      }

      const flavors = item.flavorsText
        ? item.flavorsText
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        : []

      await updateDoc(doc(db, 'products', item.docId), {
        name: item.name.trim(),
        section: item.section.trim(),
        desc: item.desc?.trim?.() ?? '',
        long_desc: item.long_desc?.trim?.() ?? '',
        price: priceValue,
        flavors,
        toppingIds: Array.isArray(item.toppingIds) ? item.toppingIds : [],
        image: item.image?.trim?.() ?? '',
        isActive: item.isActive ?? true,
      })

      if (editingImageFile) {
        const { url: imageUrl } = await uploadToCloudinary(editingImageFile, 'products')
        await updateDoc(doc(db, 'products', item.docId), { imageUrl })
        setEditingImageFile(null)
        item.imageUrl = imageUrl
      }
      setMenuItems((prev) =>
        prev.map((entry) => (entry.docId === item.docId ? { ...entry, ...item } : entry))
      )
      setEditingItem(null)
    } catch (err) {
      setMenuError('No se pudo actualizar el producto.')
    } finally {
      setMenuSavingId(null)
    }
  }

  const handleDeleteMenuItem = async (item) => {
    if (!item?.docId) return
    setMenuSavingId(item.docId)
    setMenuError('')
    try {
      await deleteDoc(doc(db, 'products', item.docId))
      setMenuItems((prev) => prev.filter((entry) => entry.docId !== item.docId))
      if (editingItem?.docId === item.docId) {
        setEditingItem(null)
      }
    } catch (err) {
      setMenuError('No se pudo eliminar el producto.')
    } finally {
      setMenuSavingId(null)
    }
  }

  const handleToggleProductActive = async (item) => {
    if (!item?.docId) return
    setMenuSavingId(item.docId)
    setMenuError('')
    try {
      const nextValue = item.isActive === false ? true : false
      await updateDoc(doc(db, 'products', item.docId), {
        isActive: nextValue,
      })
      setMenuItems((prev) =>
        prev.map((entry) =>
          entry.docId === item.docId ? { ...entry, isActive: nextValue } : entry
        )
      )
      if (editingItem?.docId === item.docId) {
        setEditingItem((prev) => ({ ...prev, isActive: nextValue }))
      }
    } catch (err) {
      setMenuError('No se pudo actualizar el estado del producto.')
    } finally {
      setMenuSavingId(null)
    }
  }

  const handleToggleSectionVisible = async (section) => {
    if (!section?.docId) return
    setMenuSavingId(section.docId)
    setMenuError('')
    try {
      const next = section.visible === false ? true : false
      await updateDoc(doc(db, 'sections', section.docId), { visible: next })
      setMenuSections((prev) =>
        prev.map((s) => (s.docId === section.docId ? { ...s, visible: next } : s))
      )
    } catch {
      setMenuError('No se pudo actualizar la visibilidad de la sección.')
    } finally {
      setMenuSavingId(null)
    }
  }

  // Carousel handlers.
  const loadCarouselSlides = async () => {
    setCarouselLoading(true)
    setCarouselError('')
    try {
      const snapshot = await getDocs(
        query(collection(db, 'carousel'), orderBy('order', 'asc'))
      )
      setCarouselSlides(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch {
      setCarouselError('No se pudo cargar el carrusel.')
    } finally {
      setCarouselLoading(false)
    }
  }

  const loadCarouselLinkedItems = async () => {
    setCarouselItemsLoading(true)
    try {
      const prodSnap = await getDocs(collection(db, 'products'))
      const allProducts = prodSnap.docs.map((d) => ({
        docId: d.id,
        name: d.data().name ?? d.id,
        section: d.data().section ?? '',
      }))
      setCarouselProducts(allProducts)
      setCarouselCombos(
        allProducts.filter((p) => p.section.toLowerCase() === 'combos' || p.section.toLowerCase() === 'combo')
      )
    } catch {
      // non-fatal
    } finally {
      setCarouselItemsLoading(false)
    }
  }

  const handleAddCarouselSlide = async (event) => {
    event.preventDefault()
    setCarouselError('')
    setCarouselSuccess('')
    if (!carouselImageFile) {
      setCarouselError('Selecciona una imagen.')
      return
    }
    if (!carouselLinkedId) {
      setCarouselError('Selecciona un producto o combo vinculado.')
      return
    }
    setIsSubmitting(true)
    try {
      const { url, publicId } = await uploadToCloudinary(carouselImageFile, 'carousel')
      await addDoc(collection(db, 'carousel'), {
        imageUrl:  url,
        publicId:  publicId,
        altText:   carouselAltText.trim(),
        linkType:  carouselLinkType,
        linkedId:  carouselLinkedId,
        order:     carouselOrder === '' ? 0 : Number(carouselOrder),
        active:    carouselActive,
        createdAt: serverTimestamp(),
      })
      setCarouselAltText('')
      setCarouselLinkType('product')
      setCarouselLinkedId('')
      setCarouselOrder('')
      setCarouselActive(true)
      setCarouselImageFile(null)
      setCarouselSuccess('Diapositiva guardada.')
      loadCarouselSlides()
    } catch {
      setCarouselError('No se pudo guardar la diapositiva.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveCarouselSlide = async (slide) => {
    if (!slide?.id) return
    setCarouselLoading(true)
    setCarouselError('')
    try {
      const updates = {
        altText:  slide.altText?.trim()  ?? '',
        linkType: slide.linkType         ?? 'product',
        linkedId: slide.linkedId         ?? '',
        order:    slide.order === '' ? 0 : Number(slide.order),
        active:   slide.active           ?? true,
      }
      if (editingSlideImageFile) {
        const { url, publicId } = await uploadToCloudinary(editingSlideImageFile, 'carousel')
        updates.imageUrl = url
        updates.publicId = publicId
        setEditingSlideImageFile(null)
      }
      await updateDoc(doc(db, 'carousel', slide.id), updates)
      setCarouselSlides((prev) =>
        prev.map((s) => (s.id === slide.id ? { ...s, ...updates } : s))
      )
      setEditingSlide(null)
    } catch {
      setCarouselError('No se pudo actualizar la diapositiva.')
    } finally {
      setCarouselLoading(false)
    }
  }

  const handleToggleSlideActive = async (slide) => {
    const next = !slide.active
    try {
      await updateDoc(doc(db, 'carousel', slide.id), { active: next })
      setCarouselSlides((prev) =>
        prev.map((s) => (s.id === slide.id ? { ...s, active: next } : s))
      )
    } catch {
      setCarouselError('No se pudo actualizar la diapositiva.')
    }
  }

  const handleDeleteCarouselSlide = async (slide) => {
    if (!slide?.id) return
    setCarouselLoading(true)
    setCarouselError('')
    try {
      await deleteDoc(doc(db, 'carousel', slide.id))
      // Note: Cloudinary deletion requires server-side signed API; publicId is
      // stored in Firestore for future server-side cleanup if needed.
      setCarouselSlides((prev) => prev.filter((s) => s.id !== slide.id))
      setDeleteSlideTarget(null)
    } catch {
      setCarouselError('No se pudo eliminar la diapositiva.')
    } finally {
      setCarouselLoading(false)
    }
  }

  const handleSlideReorder = async (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    const reordered = [...carouselSlides]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const withOrder = reordered.map((s, i) => ({ ...s, order: i }))
    setCarouselSlides(withOrder)
    try {
      const batch = writeBatch(db)
      withOrder.forEach((s) => {
        batch.update(doc(db, 'carousel', s.id), { order: s.order })
      })
      await batch.commit()
    } catch {
      setCarouselError('No se pudo reordenar las diapositivas.')
      loadCarouselSlides()
    }
  }

  // ── Toppings CRUD ────────────────────────────────────────────────────────────

  const loadToppings = async () => {
    setToppingsLoading(true)
    setToppingsError('')
    try {
      const snap = await getDocs(collection(db, 'toppings'))
      setToppingsList(
        snap.docs
          .map((d) => ({ docId: d.id, ...d.data() }))
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      )
    } catch {
      setToppingsError('No se pudieron cargar los toppings.')
    } finally {
      setToppingsLoading(false)
    }
  }

  const handleAddTopping = async (event) => {
    event.preventDefault()
    setToppingsError('')
    setToppingsSuccess('')
    const name = toppingName.trim()
    const price = Number(toppingPrice)
    if (!name || !Number.isFinite(price)) {
      setToppingsError('Nombre y precio válido son obligatorios.')
      return
    }
    setIsSubmitting(true)
    try {
      const ref = await addDoc(collection(db, 'toppings'), {
        name,
        price,
        isActive: true,
        createdAt: serverTimestamp(),
      })
      setToppingsList((prev) =>
        [...prev, { docId: ref.id, name, price, isActive: true }].sort((a, b) =>
          String(a.name).localeCompare(String(b.name))
        )
      )
      setToppingName('')
      setToppingPrice('')
      setToppingsSuccess('Topping guardado.')
    } catch {
      setToppingsError('No se pudo guardar el topping.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveTopping = async (topping) => {
    if (!topping?.docId) return
    const name = topping.name?.trim?.() ?? ''
    const price = Number(topping.price)
    if (!name || !Number.isFinite(price)) {
      setToppingsError('Nombre y precio válido son obligatorios.')
      return
    }
    setToppingsError('')
    try {
      await updateDoc(doc(db, 'toppings', topping.docId), { name, price })
      setToppingsList((prev) =>
        prev
          .map((t) => (t.docId === topping.docId ? { ...t, name, price } : t))
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      )
      setEditingTopping(null)
    } catch {
      setToppingsError('No se pudo actualizar el topping.')
    }
  }

  const handleDeleteTopping = async (topping) => {
    if (!topping?.docId) return
    setToppingsError('')
    try {
      await deleteDoc(doc(db, 'toppings', topping.docId))
      setToppingsList((prev) => prev.filter((t) => t.docId !== topping.docId))
      setDeleteToppingTarget(null)
    } catch {
      setToppingsError('No se pudo eliminar el topping.')
    }
  }

  // ── End toppings CRUD ─────────────────────────────────────────────────────

  // Keep the menu editor data fresh when opening it.
  useEffect(() => {
    if (isMenuEditOpen) {
      loadMenuItems()
      loadMenuSections()
    }
  }, [isMenuEditOpen])

  useEffect(() => {
    if (isPromoFormOpen) {
      loadActivePromotions()
    }
  }, [isPromoFormOpen])

  useEffect(() => {
    if (isCarouselOpen) {
      loadCarouselSlides()
      loadCarouselLinkedItems()
    }
  }, [isCarouselOpen])

  useEffect(() => {
    if (isProductFormOpen) {
      loadMenuSections()
      loadToppings()
    }
  }, [isProductFormOpen])

  useEffect(() => {
    if (isToppingsOpen) {
      loadToppings()
    }
  }, [isToppingsOpen])

  // Creates a product document in Firestore.
  const withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timeout`)), ms)
      ),
    ])

  const handleAddProduct = async (event) => {
    event.preventDefault()
    setError('')
    setProductSuccess('')

    try {
      const trimmedName = productName.trim()
      const trimmedSection = productSection.trim()
      const priceValue = Number(productPrice)

      if (!trimmedName || !trimmedSection || !Number.isFinite(priceValue)) {
        setError('Completa nombre, sección y precio válido.')
        return
      }

      setIsSubmitting(true)

      const flavors = productFlavors
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

      const productRef = await addDoc(collection(db, 'products'), {
        name: trimmedName,
        section: trimmedSection,
        desc: productDesc.trim(),
        long_desc: productLongDesc.trim(),
        price: priceValue,
        flavors,
        toppingIds: productToppingIds,
        image: productImage.trim(),
        isActive: true,
        createdAt: serverTimestamp(),
      })

      if (productImageFile) {
        try {
          const { url: imageUrl } = await uploadToCloudinary(productImageFile, 'products')
          await updateDoc(doc(db, 'products', productRef.id), { imageUrl })
        } catch (uploadError) {
          console.error('Failed to upload product image:', uploadError)
          setError('Producto creado, pero la imagen no se pudo subir.')
        }
      }

      setProductName('')
      setProductSection('')
      setProductDesc('')
      setProductLongDesc('')
      setProductPrice('')
      setProductFlavors('')
      setProductImage('')
      setProductImageFile(null)
      setProductToppingIds([])
      setProductSuccess('Producto guardado correctamente.')
    } catch (err) {
      setError('No se pudo guardar el producto. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Creates a section document in Firestore.
  const handleAddSection = async (event) => {
    event.preventDefault()
    setError('')
    setSectionSuccess('')

    try {
      const trimmedName = sectionName.trim()
      const trimmedCategory = sectionCategory.trim()
      const orderValue = sectionOrder === '' ? null : Number(sectionOrder)

      if (!trimmedName || !trimmedCategory) {
        setError('Completa nombre y categoría de la sección.')
        return
      }

      if (sectionOrder !== '' && !Number.isFinite(orderValue)) {
        setError('El orden debe ser un número válido.')
        return
      }

      setIsSubmitting(true)

      await addDoc(collection(db, 'sections'), {
        name: trimmedName,
        desc: sectionDesc.trim(),
        category: trimmedCategory,
        order: orderValue ?? 0,
        image: sectionImage.trim(),
        createdAt: serverTimestamp(),
      })

      setSectionName('')
      setSectionDesc('')
      setSectionCategory('')
      setSectionOrder('')
      setSectionImage('')
      setSectionSuccess('Sección guardada correctamente.')
    } catch (err) {
      setError('No se pudo guardar la sección. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-main-900 text-light-200 flex items-center justify-center">
        <p className="text-sm uppercase tracking-[0.35em] text-light-200/70">
          Cargando acceso
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-main-900 text-light-200">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-main-800/95 backdrop-blur">
          <div className="container mx-auto flex items-center justify-between px-4 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-light-200/70">
                Admin Panel
              </p>
              <h1 className="text-2xl font-semibold">Mi Cafetería</h1>
            </div>
            <NavLink
              to="/"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
            >
              Volver al menú
            </NavLink>
          </div>
        </header>

        <main className="container mx-auto px-4 pb-12 pt-28">
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-main-800/60 p-6 shadow-[0_28px_60px_rgba(0,0,0,0.45)]">
            <h2 className="text-xl font-semibold">Inicia sesión</h2>
            <p className="mt-2 text-sm text-light-200/70">
              Acceso restringido solo para administradores.
            </p>

            <form className="mt-6 grid gap-4" onSubmit={handleLogin}>
              <label className="grid gap-2 text-sm">
                Correo
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm">
                Contraseña
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </label>

              {error && (
                <p className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl border border-white/20 bg-main-900/70 px-4 py-3 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="flex items-center gap-3 text-xs text-light-200/50">
                <span className="h-px flex-1 bg-white/10" />
                o
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Conectando...' : 'Entrar con Google'}
              </button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-main-900 text-light-200">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-main-800/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-light-200/70">Admin Panel</p>
            <h1 className="text-2xl font-semibold">Mi Cafetería</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
            >
              Cerrar sesión
            </button>
            <NavLink
              to="/"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
            >
              Volver al menú
            </NavLink>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-12 pt-28">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-main-800/60 p-6 shadow-[0_28px_60px_rgba(0,0,0,0.45)]">
            <h2 className="text-xl font-semibold">Resumen rápido</h2>
            <p className="mt-2 text-sm text-light-200/70">
              Aquí verás los pedidos recientes, alertas de inventario y notas del día.
            </p>
            {statsError && (
              <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {statsError}
              </p>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Pedidos hoy', value: stats.ordersToday },
                {
                  label: 'Ingresos',
                  value: stats.totalRevenue.toLocaleString('es-MX', {
                    style: 'currency',
                    currency: 'MXN',
                    maximumFractionDigits: 2,
                  }),
                },
                {
                  label: 'Promedio ticket',
                  value: stats.avgTicket.toLocaleString('es-MX', {
                    style: 'currency',
                    currency: 'MXN',
                    maximumFractionDigits: 2,
                  }),
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-main-900/70 p-4"
                >
                  <p className="text-xs uppercase tracking-widest text-light-200/60">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-light-200">
                    {statsLoading ? '...' : stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-main-800/60 p-6">
            <h2 className="text-xl font-semibold">Acciones rápidas</h2>
            <div className="mt-5 grid gap-3">
              {[
                'Agregar producto',
                'Programar promociones',
                'Actualizar menú',
              ].map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => {
                    if (action === 'Agregar producto') {
                      setIsProductFormOpen((prev) => !prev)
                      setIsSectionFormOpen(false)
                      setIsMenuEditOpen(false)
                      setIsPromoFormOpen(false)
                      setIsCarouselOpen(false)
                      setIsToppingsOpen(false)
                    }
                    if (action === 'Actualizar menú') {
                      setIsMenuEditOpen((prev) => !prev)
                      setIsProductFormOpen(false)
                      setIsSectionFormOpen(false)
                      setIsPromoFormOpen(false)
                      setIsCarouselOpen(false)
                      setIsToppingsOpen(false)
                    }
                    if (action === 'Programar promociones') {
                      setIsPromoFormOpen((prev) => !prev)
                      setIsProductFormOpen(false)
                      setIsSectionFormOpen(false)
                      setIsMenuEditOpen(false)
                      setIsCarouselOpen(false)
                      setIsToppingsOpen(false)
                    }
                  }}
                  className="rounded-2xl border border-white/15 bg-main-900/60 px-4 py-3 text-left text-sm font-semibold transition hover:border-white/35 hover:text-light-400"
                >
                  {action}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsSectionFormOpen((prev) => !prev)
                  setIsProductFormOpen(false)
                  setIsMenuEditOpen(false)
                  setIsCarouselOpen(false)
                  setIsToppingsOpen(false)
                }}
                className="w-full rounded-2xl border border-white/15 bg-main-900/60 px-4 py-3 text-left text-sm font-semibold transition hover:border-white/35 hover:text-light-400"
              >
                {isSectionFormOpen ? 'Ocultar sección' : 'Agregar sección'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCarouselOpen((prev) => !prev)
                  setIsProductFormOpen(false)
                  setIsSectionFormOpen(false)
                  setIsMenuEditOpen(false)
                  setIsPromoFormOpen(false)
                  setIsToppingsOpen(false)
                }}
                className="w-full rounded-2xl border border-white/15 bg-main-900/60 px-4 py-3 text-left text-sm font-semibold transition hover:border-white/35 hover:text-light-400"
              >
                {isCarouselOpen ? 'Ocultar carrusel' : 'Gestionar carrusel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsToppingsOpen((prev) => !prev)
                  setIsProductFormOpen(false)
                  setIsSectionFormOpen(false)
                  setIsMenuEditOpen(false)
                  setIsPromoFormOpen(false)
                  setIsCarouselOpen(false)
                }}
                className="w-full rounded-2xl border border-white/15 bg-main-900/60 px-4 py-3 text-left text-sm font-semibold transition hover:border-white/35 hover:text-light-400"
              >
                {isToppingsOpen ? 'Ocultar toppings' : 'Gestionar toppings'}
              </button>
            </div>
          </div>
        </section>

        {isProductFormOpen && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-main-800/60 p-6">
            <h2 className="text-xl font-semibold">Agregar producto</h2>
            <p className="mt-2 text-sm text-light-200/70">
              Crea un nuevo producto en Firestore.
            </p>

            <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={handleAddProduct}>
              <label className="grid gap-2 text-sm">
                Nombre
                <input
                  type="text"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm">
                Sección
                {menuSectionsLoading ? (
                  <div className="h-12 rounded-2xl bg-main-900/50 animate-pulse" />
                ) : (
                  <select
                    value={productSection}
                    onChange={(event) => setProductSection(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                    required
                  >
                    <option value="" disabled>
                      {menuSections.length === 0 ? 'Sin secciones disponibles' : 'Selecciona una sección'}
                    </option>
                    {menuSections.map((section) => (
                      <option key={section.docId ?? section.name} value={section.name}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="grid gap-2 text-sm">
                Descripción corta
                <input
                  type="text"
                  value={productDesc}
                  onChange={(event) => setProductDesc(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Descripción larga
                <input
                  type="text"
                  value={productLongDesc}
                  onChange={(event) => setProductLongDesc(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Precio
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productPrice}
                  onChange={(event) => setProductPrice(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </label>
            <label className="grid gap-2 text-sm lg:col-span-2">
              Imagen
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setProductImageFile(event.target.files?.[0] ?? null)}
                className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
              />
              {productImageFile && (
                <img
                  src={URL.createObjectURL(productImageFile)}
                  alt="Vista previa"
                  className="mt-1 h-32 w-32 rounded-2xl object-cover shadow-lg"
                />
              )}
            </label>
              <label className="grid gap-2 text-sm lg:col-span-2">
                Sabores (separados por comas)
                <input
                  type="text"
                  value={productFlavors}
                  onChange={(event) => setProductFlavors(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  placeholder="Taro, Mango, Matcha"
                />
              </label>

              {toppingsList.length > 0 && (
                <div className="grid gap-2 text-sm lg:col-span-2">
                  <span className="text-light-200/80">Toppings disponibles para este producto</span>
                  <div className="flex flex-wrap gap-2">
                    {toppingsList.map((t) => {
                      const checked = productToppingIds.includes(t.docId)
                      return (
                        <label
                          key={t.docId}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${checked ? 'border-main-400 bg-main-700/40 text-light-200' : 'border-white/10 bg-main-900/50 text-light-200/70 hover:border-white/30'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setProductToppingIds((prev) =>
                                prev.includes(t.docId)
                                  ? prev.filter((id) => id !== t.docId)
                                  : [...prev, t.docId]
                              )
                            }
                            className="h-3.5 w-3.5 accent-main-400"
                          />
                          {t.name} (+${t.price})
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100 lg:col-span-2">
                  {error}
                </p>
              )}
              {productSuccess && (
                <p className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 lg:col-span-2">
                  {productSuccess}
                </p>
              )}

              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl border border-white/20 bg-main-900/70 px-6 py-3 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar producto'}
                </button>
              </div>
            </form>
          </section>
        )}

        {isSectionFormOpen && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-main-800/60 p-6">
            <h2 className="text-xl font-semibold">Agregar sección</h2>
            <p className="mt-2 text-sm text-light-200/70">
              Crea nuevas secciones para el menú.
            </p>

            <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={handleAddSection}>
              <label className="grid gap-2 text-sm">
                Nombre
                <input
                  type="text"
                  value={sectionName}
                  onChange={(event) => setSectionName(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm">
                Categoría
                <input
                  type="text"
                  value={sectionCategory}
                  onChange={(event) => setSectionCategory(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm lg:col-span-2">
                Descripción
                <input
                  type="text"
                  value={sectionDesc}
                  onChange={(event) => setSectionDesc(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Orden
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={sectionOrder}
                  onChange={(event) => setSectionOrder(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Imagen (opcional)
                <input
                  type="text"
                  value={sectionImage}
                  onChange={(event) => setSectionImage(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                />
              </label>

              {sectionSuccess && (
                <p className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 lg:col-span-2">
                  {sectionSuccess}
                </p>
              )}

              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl border border-white/20 bg-main-900/70 px-6 py-3 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar sección'}
                </button>
              </div>
            </form>
          </section>
        )}

        {isPromoFormOpen && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-main-800/60 p-6">
            <h2 className="text-xl font-semibold">Programar promoción</h2>
            <p className="mt-2 text-sm text-light-200/70">
              Activa una promoción para mostrarla en la pantalla principal.
            </p>

            <form className="mt-6 grid gap-4" onSubmit={handleCreatePromotion}>
              <label className="grid gap-2 text-sm">
                Título
                <input
                  type="text"
                  value={promoTitle}
                  onChange={(event) => setPromoTitle(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm">
                Mensaje (opcional)
                <textarea
                  value={promoMessage}
                  onChange={(event) => setPromoMessage(event.target.value)}
                  rows={3}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                />
              </label>

              {promoError && (
                <p className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {promoError}
                </p>
              )}
              {promoSuccess && (
                <p className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {promoSuccess}
                </p>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl border border-white/20 bg-main-900/70 px-6 py-3 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Guardando...' : 'Activar promoción'}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-light-200/80">
                Promociones activas
              </h3>
              {promoListError && (
                <p className="mt-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {promoListError}
                </p>
              )}
              {promoListLoading ? (
                <div className="mt-3 h-12 rounded-2xl bg-main-900/50 animate-pulse" />
              ) : activePromos.length ? (
                <div className="mt-3 grid gap-2">
                  {activePromos.map((promo) => (
                    <div
                      key={promo.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-light-200">
                          {promo.title}
                        </p>
                        {promo.message && (
                          <p className="text-xs text-light-200/60">{promo.message}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeactivatePromotion(promo)}
                        className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3 text-sm text-light-200/70">
                  No hay promociones activas.
                </div>
              )}
            </div>
          </section>
        )}

        {isCarouselOpen && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-main-800/60 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Carrusel de promociones</h2>
                <p className="mt-1 text-sm text-light-200/70">
                  Las diapositivas activas aparecen en la pantalla de inicio. Arrastra para reordenar.
                </p>
              </div>
              <button
                type="button"
                onClick={loadCarouselSlides}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
              >
                Recargar
              </button>
            </div>

            {/* ── Add slide form ─────────────────────────────────────── */}
            <form
              className="mt-6 rounded-2xl border border-white/10 bg-main-900/50 p-5 grid gap-4 lg:grid-cols-2"
              onSubmit={handleAddCarouselSlide}
            >
              <h3 className="text-sm font-semibold text-light-200/80 lg:col-span-2">Nueva diapositiva</h3>

              {/* Image upload */}
              <label className="grid gap-2 text-sm lg:col-span-2">
                Imagen (portrait, se adaptará a 9:16)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCarouselImageFile(e.target.files?.[0] ?? null)}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  required
                />
              </label>

              {/* Alt text */}
              <label className="grid gap-2 text-sm">
                Texto alternativo (accesibilidad)
                <input
                  type="text"
                  value={carouselAltText}
                  onChange={(e) => setCarouselAltText(e.target.value)}
                  placeholder="Ej: Combo brunch de verano"
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                />
              </label>

              {/* Link type */}
              <label className="grid gap-2 text-sm">
                Tipo de vínculo
                <select
                  value={carouselLinkType}
                  onChange={(e) => { setCarouselLinkType(e.target.value); setCarouselLinkedId('') }}
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                >
                  <option value="product">Producto</option>
                  <option value="combo">Combo</option>
                </select>
              </label>

              {/* Linked item searchable select */}
              <label className="grid gap-2 text-sm lg:col-span-2">
                {carouselLinkType === 'product' ? 'Producto vinculado' : 'Combo vinculado'}
                {carouselItemsLoading ? (
                  <div className="h-12 rounded-2xl bg-main-900/50 animate-pulse" />
                ) : (
                  <select
                    value={carouselLinkedId}
                    onChange={(e) => setCarouselLinkedId(e.target.value)}
                    required
                    className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  >
                    <option value="">— Selecciona —</option>
                    {(carouselLinkType === 'product' ? carouselProducts : carouselCombos).map((item) => (
                      <option key={item.docId} value={item.docId}>{item.name}</option>
                    ))}
                  </select>
                )}
              </label>

              {/* Order + Active */}
              <label className="grid gap-2 text-sm">
                Orden de visualización
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={carouselOrder}
                  onChange={(e) => setCarouselOrder(e.target.value)}
                  placeholder="0"
                  className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                />
              </label>

              <label className="flex items-center gap-3 text-sm cursor-pointer self-end pb-3">
                <span className="text-light-200/80">Activa al crear</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={carouselActive}
                  onClick={() => setCarouselActive((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${carouselActive ? 'bg-main-500' : 'bg-white/20'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${carouselActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>

              {carouselError && (
                <p className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100 lg:col-span-2">
                  {carouselError}
                </p>
              )}
              {carouselSuccess && (
                <p className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 lg:col-span-2">
                  {carouselSuccess}
                </p>
              )}

              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl border border-white/20 bg-main-900/70 px-6 py-3 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Subiendo…' : 'Agregar diapositiva'}
                </button>
              </div>
            </form>

            {/* ── Slides list (drag-to-reorder) ─────────────────────── */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-light-200/80">
                Diapositivas ({carouselSlides.length})
                {carouselSlides.length > 1 && (
                  <span className="ml-2 font-normal text-light-200/50 text-xs">arrastra para reordenar</span>
                )}
              </h3>
              {carouselLoading ? (
                <div className="mt-3 grid gap-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-main-900/50 animate-pulse" />
                  ))}
                </div>
              ) : carouselSlides.length ? (
                <div className="mt-3 grid gap-3">
                  {carouselSlides.map((slide, idx) => (
                    <div
                      key={slide.id}
                      draggable
                      onDragStart={() => { dragSlideIdxRef.current = idx }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleSlideReorder(dragSlideIdxRef.current, idx)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      {editingSlide?.id === slide.id ? (
                        /* ── Edit form ── */
                        <div className="rounded-2xl border border-white/15 bg-main-900/60 p-4 grid gap-3 lg:grid-cols-2">
                          <label className="grid gap-1 text-xs lg:col-span-2">
                            Nueva imagen (opcional)
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setEditingSlideImageFile(e.target.files?.[0] ?? null)}
                              className="rounded-xl border border-white/10 bg-main-900/70 px-3 py-2 text-light-200 outline-none"
                            />
                          </label>
                          <label className="grid gap-1 text-xs">
                            Texto alternativo
                            <input
                              type="text"
                              value={editingSlide.altText ?? ''}
                              onChange={(e) => setEditingSlide((p) => ({ ...p, altText: e.target.value }))}
                              className="rounded-xl border border-white/10 bg-main-900/70 px-3 py-2 text-light-200 outline-none"
                            />
                          </label>
                          <label className="grid gap-1 text-xs">
                            Tipo de vínculo
                            <select
                              value={editingSlide.linkType ?? 'product'}
                              onChange={(e) => setEditingSlide((p) => ({ ...p, linkType: e.target.value, linkedId: '' }))}
                              className="rounded-xl border border-white/10 bg-main-900/70 px-3 py-2 text-light-200 outline-none"
                            >
                              <option value="product">Producto</option>
                              <option value="combo">Combo</option>
                            </select>
                          </label>
                          <label className="grid gap-1 text-xs lg:col-span-2">
                            {editingSlide.linkType === 'combo' ? 'Combo vinculado' : 'Producto vinculado'}
                            <select
                              value={editingSlide.linkedId ?? ''}
                              onChange={(e) => setEditingSlide((p) => ({ ...p, linkedId: e.target.value }))}
                              className="rounded-xl border border-white/10 bg-main-900/70 px-3 py-2 text-light-200 outline-none"
                            >
                              <option value="">— Selecciona —</option>
                              {(editingSlide.linkType === 'combo' ? carouselCombos : carouselProducts).map((item) => (
                                <option key={item.docId} value={item.docId}>{item.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-1 text-xs">
                            Orden
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editingSlide.order ?? 0}
                              onChange={(e) => setEditingSlide((p) => ({ ...p, order: e.target.value }))}
                              className="rounded-xl border border-white/10 bg-main-900/70 px-3 py-2 text-light-200 outline-none"
                            />
                          </label>
                          <label className="flex items-center gap-3 text-xs cursor-pointer self-end pb-1">
                            <span className="text-light-200/70">Activa</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={editingSlide.active ?? true}
                              onClick={() => setEditingSlide((p) => ({ ...p, active: !(p.active ?? true) }))}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${(editingSlide.active ?? true) ? 'bg-main-500' : 'bg-white/20'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${(editingSlide.active ?? true) ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                            </button>
                          </label>
                          <div className="lg:col-span-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveCarouselSlide(editingSlide)}
                              disabled={carouselLoading}
                              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:opacity-60"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingSlide(null); setEditingSlideImageFile(null) }}
                              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-light-200/70 transition hover:text-light-200"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── Row view ── */
                        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3">
                          {/* Drag handle */}
                          <span className="text-light-200/30 text-lg select-none flex-shrink-0">⠿</span>

                          {slide.imageUrl && (
                            <img
                              src={slide.imageUrl}
                              alt={slide.altText || 'Slide'}
                              className="h-14 w-9 rounded-lg object-contain bg-black flex-shrink-0 shadow"
                            />
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-light-200 truncate">
                              {slide.altText || <span className="text-light-200/50 italic">Sin descripción</span>}
                            </p>
                            <p className="text-xs text-light-200/60">
                              {slide.linkType === 'combo' ? 'Combo' : 'Producto'} · ID: {slide.linkedId || '—'} · orden {slide.order ?? 0}
                            </p>
                          </div>

                          {/* Active toggle */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={slide.active ?? true}
                            title={slide.active ? 'Activa — clic para desactivar' : 'Inactiva — clic para activar'}
                            onClick={() => handleToggleSlideActive(slide)}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition ${(slide.active ?? true) ? 'bg-main-500' : 'bg-white/20'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${(slide.active ?? true) ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                          </button>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => { setEditingSlide({ ...slide }); loadCarouselLinkedItems() }}
                              className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteSlideTarget(slide)}
                              className="rounded-full border border-red-300/30 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-300/60 hover:text-red-200"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3 text-sm text-light-200/70">
                  No hay diapositivas. Agrega una arriba.
                </div>
              )}
            </div>
          </section>
        )}

        {/* Delete slide confirmation modal */}
        {deleteSlideTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteSlideTarget(null)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative w-full max-w-sm rounded-2xl bg-light-200 p-6 text-main-800 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-lg font-semibold">¿Eliminar diapositiva?</div>
              <p className="mt-2 text-sm text-main-600">
                Se eliminará del carrusel permanentemente. La imagen en Cloudinary deberá eliminarse manualmente si ya no se necesita.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteSlideTarget(null)}
                  className="rounded-lg border border-main-300 px-3 py-2 text-sm text-main-700 hover:bg-main-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCarouselSlide(deleteSlideTarget)}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {isToppingsOpen && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-main-800/60 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Gestionar toppings</h2>
                <p className="mt-1 text-sm text-light-200/70">
                  Crea, edita o elimina los extras que pueden agregarse a los productos.
                </p>
              </div>
              <button
                type="button"
                onClick={loadToppings}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
              >
                Recargar
              </button>
            </div>

            {/* Add topping form */}
            <form
              className="mt-6 rounded-2xl border border-white/10 bg-main-900/50 p-5 grid gap-4 sm:grid-cols-[1fr_auto_auto]"
              onSubmit={handleAddTopping}
            >
              <input
                type="text"
                value={toppingName}
                onChange={(e) => setToppingName(e.target.value)}
                placeholder="Nombre del topping (ej. Queso extra)"
                className="rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={toppingPrice}
                onChange={(e) => setToppingPrice(e.target.value)}
                placeholder="Precio"
                className="w-32 rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl border border-white/20 bg-main-900/70 px-5 py-3 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:opacity-60"
              >
                {isSubmitting ? 'Guardando...' : 'Agregar'}
              </button>

              {toppingsError && (
                <p className="col-span-full rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {toppingsError}
                </p>
              )}
              {toppingsSuccess && (
                <p className="col-span-full rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {toppingsSuccess}
                </p>
              )}
            </form>

            {/* Toppings list */}
            <div className="mt-6">
              {toppingsLoading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-2xl bg-main-900/50 animate-pulse" />
                  ))}
                </div>
              ) : toppingsList.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3 text-sm text-light-200/70">
                  No hay toppings creados aún.
                </div>
              ) : (
                <div className="grid gap-3">
                  {toppingsList.map((topping) => (
                    <div
                      key={topping.docId}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3"
                    >
                      {editingTopping?.docId === topping.docId ? (
                        <>
                          <input
                            type="text"
                            value={editingTopping.name ?? ''}
                            onChange={(e) =>
                              setEditingTopping((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="flex-1 rounded-xl border border-white/10 bg-main-900/70 px-3 py-2 text-sm text-light-200 outline-none focus:border-white/40"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingTopping.price ?? ''}
                            onChange={(e) =>
                              setEditingTopping((prev) => ({ ...prev, price: e.target.value }))
                            }
                            className="w-28 rounded-xl border border-white/10 bg-main-900/70 px-3 py-2 text-sm text-light-200 outline-none focus:border-white/40"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveTopping(editingTopping)}
                            className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-light-200 transition hover:border-white/40"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTopping(null)}
                            className="rounded-full border border-white/20 px-3 py-2 text-xs text-light-200/70 transition hover:border-white/40"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-light-200">{topping.name}</p>
                            <p className="text-xs text-light-200/60">
                              +${Number(topping.price || 0).toFixed(2)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingTopping({ ...topping })}
                            className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteToppingTarget(topping)}
                            className="rounded-full border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Delete topping confirmation */}
        {deleteToppingTarget && (
          <div
            className="fixed inset-0 z-90 flex items-center justify-center px-6"
            role="dialog"
            aria-modal="true"
            onClick={() => setDeleteToppingTarget(null)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative w-full max-w-sm rounded-2xl bg-light-200 p-6 text-main-800 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-lg font-semibold">¿Eliminar topping?</p>
              <p className="mt-2 text-sm text-main-600">
                Se eliminará <strong>{deleteToppingTarget.name}</strong>. Los productos que lo tenían
                asignado dejarán de mostrarlo.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteToppingTarget(null)}
                  className="rounded-lg border border-main-300 px-3 py-2 text-sm text-main-700 hover:bg-main-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTopping(deleteToppingTarget)}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {isMenuEditOpen && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-main-800/60 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Actualizar menú</h2>
                <p className="mt-2 text-sm text-light-200/70">
                  Edita productos y guarda cambios individuales.
                </p>
              </div>
              <button
                type="button"
                onClick={loadMenuItems}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
              >
                Recargar
              </button>
            </div>

            {menuError && (
              <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {menuError}
              </p>
            )}
            {menuSectionsError && (
              <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {menuSectionsError}
              </p>
            )}

            {menuLoading || menuSectionsLoading ? (
              <div className="mt-6 grid gap-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div
                    key={`menu-skeleton-${idx}`}
                    className="h-16 rounded-2xl bg-main-900/50 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {menuSections.map((section) => {
                  const sectionProducts = menuItems.filter(
                    (item) => item.section === section.name
                  )

                  return (
                    <div
                      key={section.docId ?? section.name}
                      className="rounded-3xl border border-white/10 bg-main-900/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-light-200">
                            {section.name}
                          </h3>
                          <p className="text-xs text-light-200/60">
                            {section.category} · {sectionProducts.length} productos
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Visibility toggle */}
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-light-200/60 select-none">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={section.visible !== false}
                              title={section.visible === false ? 'Sección oculta — clic para mostrar' : 'Sección visible — clic para ocultar'}
                              disabled={menuSavingId === section.docId}
                              onClick={() => handleToggleSectionVisible(section)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${section.visible === false ? 'bg-white/20' : 'bg-main-500'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${section.visible === false ? 'translate-x-1' : 'translate-x-[18px]'}`} />
                            </button>
                            {section.visible === false ? 'Oculta' : 'Visible'}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSection({
                                ...section,
                                order: section.order ?? 0,
                                originalName: section.name,
                              })
                              setIsSectionEditorOpen(true)
                            }}
                            className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteSectionTarget(section)}
                            disabled={menuSavingId === section.docId}
                            className="rounded-full border border-red-300/30 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-300/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        {sectionProducts.map((item, idx) => (
                          <div
                            key={item.docId ?? `${item.name}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-light-200">
                                {item.name}
                              </p>
                              <p className="text-xs text-light-200/60">${item.price}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={item.isActive !== false}
                                title={item.isActive === false ? 'Producto oculto — clic para mostrar' : 'Producto visible — clic para ocultar'}
                                onClick={() => handleToggleProductActive(item)}
                                disabled={menuSavingId === item.docId}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${item.isActive === false ? 'bg-white/20' : 'bg-main-500'}`}
                              >
                                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${item.isActive === false ? 'translate-x-1' : 'translate-x-[18px]'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem({
                                    ...item,
                                    price: item.price ?? '',
                                    flavorsText: Array.isArray(item.flavors)
                                      ? item.flavors.join(', ')
                                      : item.flavorsText ?? '',
                                    toppingIds: Array.isArray(item.toppingIds) ? item.toppingIds : [],
                                  })
                                  loadToppings()
                                  setIsMenuEditorOpen(true)
                                }}
                                className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                disabled={menuSavingId === item.docId}
                                className="rounded-full border border-red-300/30 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-300/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))}
                        {sectionProducts.length === 0 && (
                          <div className="rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3 text-xs text-light-200/60">
                            No hay productos en esta sección.
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {menuItems
                  .filter(
                    (item) =>
                      !menuSections.some((section) => section.name === item.section)
                  )
                  .map((item, idx) => (
                    <div
                      key={`orphan-${item.docId ?? idx}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-light-200">{item.name}</p>
                        <p className="text-xs text-light-200/60">
                          {item.section || 'Sin sección'} · ${item.price}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.isActive !== false}
                          title={item.isActive === false ? 'Producto oculto — clic para mostrar' : 'Producto visible — clic para ocultar'}
                          onClick={() => handleToggleProductActive(item)}
                          disabled={menuSavingId === item.docId}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${item.isActive === false ? 'bg-white/20' : 'bg-main-500'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${item.isActive === false ? 'translate-x-1' : 'translate-x-[18px]'}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem({
                              ...item,
                              price: item.price ?? '',
                              flavorsText: Array.isArray(item.flavors)
                                ? item.flavors.join(', ')
                                : item.flavorsText ?? '',
                            })
                            setIsMenuEditorOpen(true)
                          }}
                          className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          disabled={menuSavingId === item.docId}
                          className="rounded-full border border-red-300/30 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-300/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}

        {isMenuEditorOpen && editingItem && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center px-6"
            role="dialog"
            aria-modal="true"
            aria-label="Editar producto"
            onClick={() => setIsMenuEditorOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-main-800/95 p-6 text-light-200 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">Editar producto</h3>
                  <p className="mt-1 text-sm text-light-200/70">
                    Actualiza los detalles y guarda los cambios.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuEditorOpen(false)}
                  className="rounded-full border border-white/20 px-3 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  Nombre
                  <input
                    type="text"
                    value={editingItem.name ?? ''}
                    onChange={(event) =>
                      setEditingItem((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  Sección
                  <select
                    value={editingItem.section ?? ''}
                    onChange={(event) =>
                      setEditingItem((prev) => ({ ...prev, section: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  >
                    {!menuSections.some(
                      (section) => section.name === (editingItem.section ?? '')
                    ) && (
                      <option value={editingItem.section ?? ''}>
                        {editingItem.section ?? 'Sin sección'}
                      </option>
                    )}
                    <option value="" disabled>
                      Selecciona una sección
                    </option>
                    {menuSections.map((section) => (
                      <option key={section.docId ?? section.name} value={section.name}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  Precio
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingItem.price ?? ''}
                    onChange={(event) =>
                      setEditingItem((prev) => ({ ...prev, price: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  />
                </label>
                <label className="grid gap-2 text-sm md:col-span-2">
                  Imagen
                  {/* preview: new file takes priority, else current stored image */}
                  {(editingImageFile || editingItem.imageUrl) && (
                    <img
                      src={editingImageFile ? URL.createObjectURL(editingImageFile) : editingItem.imageUrl}
                      alt="Vista previa"
                      className="h-32 w-32 rounded-2xl object-cover shadow-lg"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setEditingImageFile(event.target.files?.[0] ?? null)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  />
                  <span className="text-xs text-light-200/60">
                    Selecciona un archivo para reemplazar la imagen actual.
                  </span>
                </label>
                <label className="grid gap-2 text-sm md:col-span-2">
                  Descripción corta
                  <input
                    type="text"
                    value={editingItem.desc ?? ''}
                    onChange={(event) =>
                      setEditingItem((prev) => ({ ...prev, desc: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  />
                </label>
                <label className="grid gap-2 text-sm md:col-span-2">
                  Descripción larga
                  <input
                    type="text"
                    value={editingItem.long_desc ?? ''}
                    onChange={(event) =>
                      setEditingItem((prev) => ({
                        ...prev,
                        long_desc: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  />
                </label>
                <label className="grid gap-2 text-sm md:col-span-2">
                  Sabores (separados por comas)
                  <input
                    type="text"
                    value={editingItem.flavorsText ?? ''}
                    onChange={(event) =>
                      setEditingItem((prev) => ({
                        ...prev,
                        flavorsText: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                    placeholder="Taro, Mango, Matcha"
                  />
                </label>

                {toppingsList.length > 0 && (
                  <div className="grid gap-2 text-sm md:col-span-2">
                    <span className="text-light-200/80">Toppings disponibles para este producto</span>
                    <div className="flex flex-wrap gap-2">
                      {toppingsList.map((t) => {
                        const checked = (editingItem.toppingIds || []).includes(t.docId)
                        return (
                          <label
                            key={t.docId}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${checked ? 'border-main-400 bg-main-700/40 text-light-200' : 'border-white/10 bg-main-900/50 text-light-200/70 hover:border-white/30'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setEditingItem((prev) => ({
                                  ...prev,
                                  toppingIds: (prev.toppingIds || []).includes(t.docId)
                                    ? (prev.toppingIds || []).filter((id) => id !== t.docId)
                                    : [...(prev.toppingIds || []), t.docId],
                                }))
                              }
                              className="h-3.5 w-3.5 accent-main-400"
                            />
                            {t.name} (+${t.price})
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMenuEditorOpen(false)}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveMenuItem(editingItem)}
                  disabled={menuSavingId === editingItem.docId}
                  className="rounded-2xl border border-white/20 bg-main-900/70 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {menuSavingId === editingItem.docId ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isSectionEditorOpen && editingSection && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center px-6"
            role="dialog"
            aria-modal="true"
            aria-label="Editar sección"
            onClick={() => setIsSectionEditorOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-main-800/95 p-6 text-light-200 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">Editar sección</h3>
                  <p className="mt-1 text-sm text-light-200/70">
                    Actualiza el nombre, categoría y orden.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSectionEditorOpen(false)}
                  className="rounded-full border border-white/20 px-3 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  Nombre
                  <input
                    type="text"
                    value={editingSection.name ?? ''}
                    onChange={(event) =>
                      setEditingSection((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  Categoría
                  <input
                    type="text"
                    value={editingSection.category ?? ''}
                    onChange={(event) =>
                      setEditingSection((prev) => ({
                        ...prev,
                        category: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  Orden
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editingSection.order ?? 0}
                    onChange={(event) =>
                      setEditingSection((prev) => ({
                        ...prev,
                        order: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  Imagen (opcional)
                  <input
                    type="text"
                    value={editingSection.image ?? ''}
                    onChange={(event) =>
                      setEditingSection((prev) => ({
                        ...prev,
                        image: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  />
                </label>
                <label className="grid gap-2 text-sm md:col-span-2">
                  Descripción
                  <input
                    type="text"
                    value={editingSection.desc ?? ''}
                    onChange={(event) =>
                      setEditingSection((prev) => ({
                        ...prev,
                        desc: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-light-200 outline-none transition focus:border-white/40"
                  />
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSectionEditorOpen(false)}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSection(editingSection)}
                  disabled={menuSavingId === editingSection.docId}
                  className="rounded-2xl border border-white/20 bg-main-900/70 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {menuSavingId === editingSection.docId ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteSectionTarget && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center px-6"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación de sección"
            onClick={() => setDeleteSectionTarget(null)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative w-full max-w-sm rounded-2xl bg-light-200 p-6 text-main-800 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="text-lg font-semibold">¿Eliminar sección?</div>
              <p className="mt-2 text-sm text-main-600">
                Se eliminará <strong>{deleteSectionTarget.name}</strong> y todos sus
                productos.
              </p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteSectionTarget(null)}
                  className="rounded-lg border border-main-300 px-3 py-2 text-sm text-main-700 hover:bg-main-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = deleteSectionTarget
                    setDeleteSectionTarget(null)
                    handleDeleteSection(target)
                  }}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center px-6"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación"
            onClick={() => setDeleteTarget(null)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative w-full max-w-sm rounded-2xl bg-light-200 p-6 text-main-800 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="text-lg font-semibold">¿Eliminar producto?</div>
              <p className="mt-2 text-sm text-main-600">
                Se eliminará <strong>{deleteTarget.name}</strong> del menú.
              </p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg border border-main-300 px-3 py-2 text-sm text-main-700 hover:bg-main-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = deleteTarget
                    setDeleteTarget(null)
                    handleDeleteMenuItem(target)
                  }}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-white/10 bg-main-800/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Pedidos recientes</h2>
              <p className="text-sm text-light-200/70">
                Últimos pedidos realizados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAllOrders((prev) => !prev)}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
            >
              {showAllOrders ? 'Ver 5 recientes' : 'Ver 50 guardados'}
            </button>
          </div>
          <div className="mt-5 grid gap-3">
            {statsLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={`recent-skeleton-${idx}`}
                  className="h-16 rounded-2xl bg-main-900/50 animate-pulse"
                />
              ))
            ) : recentOrders.length ? (
              (showAllOrders ? recentOrders : recentOrders.slice(0, 5)).map((order) => (
                <div
                  key={order.id ?? order.orderId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-light-200">
                      {order.orderId ?? order.id}
                    </p>
                    <p className="text-xs text-light-200/60">
                      {order.createdAt?.toDate?.()
                        ? order.createdAt.toDate().toLocaleString('es-MX')
                        : 'Sin fecha'}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-light-200">
                    {Number(order.total || 0).toLocaleString('es-MX', {
                      style: 'currency',
                      currency: 'MXN',
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOrders((prev) => {
                          const next = new Set(prev)
                          const key = order.id ?? order.orderId
                          if (next.has(key)) {
                            next.delete(key)
                          } else {
                            next.add(key)
                          }
                          return next
                        })
                      }
                      className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-light-200 transition hover:border-white/40 hover:text-light-400"
                    >
                      {expandedOrders.has(order.id ?? order.orderId)
                        ? 'Ocultar detalle'
                        : 'Ver detalle'}
                    </button>
                  </div>
                  {expandedOrders.has(order.id ?? order.orderId) && (
                    <div className="mt-3 w-full rounded-2xl border border-white/10 bg-main-900/70 px-4 py-3 text-xs text-light-200/80 whitespace-pre-line">
                      {order.content || 'Sin contenido'}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-main-900/60 px-4 py-3 text-sm text-light-200/70">
                No hay pedidos recientes.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
