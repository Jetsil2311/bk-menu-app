import { useEffect, useMemo, useState, useRef } from 'react'
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

export const useAdminData = () => {

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
  const [productOptionGroups, setProductOptionGroups] = useState([])
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
  const dragSlideIdxRef = useRef(null)
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
        optionGroups: Array.isArray(item.optionGroups) ? item.optionGroups : [],
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
        optionGroups: Array.isArray(productOptionGroups) ? productOptionGroups : [],
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
      setProductOptionGroups([])
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
  return {
    activePromos,
    carouselActive,
    carouselAltText,
    carouselCombos,
    carouselError,
    carouselImageFile,
    carouselItemsLoading,
    carouselLinkType,
    carouselLinkedId,
    carouselLoading,
    carouselOrder,
    carouselProducts,
    carouselSlides,
    carouselSuccess,
    deleteSectionTarget,
    deleteSlideTarget,
    deleteTarget,
    deleteToppingTarget,
    editingImageFile,
    editingItem,
    editingSection,
    editingSlide,
    editingSlideImageFile,
    editingTopping,
    email,
    error,
    expandedOrders,
    handleAddCarouselSlide,
    handleAddProduct,
    handleAddSection,
    handleAddTopping,
    handleCreatePromotion,
    handleDeactivatePromotion,
    handleDeleteCarouselSlide,
    handleDeleteMenuItem,
    handleDeleteSection,
    handleDeleteTopping,
    handleGoogleSignIn,
    handleLogin,
    handleLogout,
    handleSaveCarouselSlide,
    handleSaveMenuItem,
    handleSaveSection,
    handleSaveTopping,
    handleSlideReorder,
    handleToggleProductActive,
    handleToggleSectionVisible,
    handleToggleSlideActive,
    isAuthReady,
    isAuthenticated,
    isCarouselOpen,
    isMenuEditOpen,
    isMenuEditorOpen,
    isProductFormOpen,
    isPromoFormOpen,
    isSectionEditorOpen,
    isSectionFormOpen,
    isSubmitting,
    isToppingsOpen,
    loadActivePromotions,
    loadCarouselLinkedItems,
    loadCarouselSlides,
    loadMenuItems,
    loadMenuSections,
    loadToppings,
    menuError,
    menuItems,
    menuLoading,
    menuSavingId,
    menuSections,
    menuSectionsError,
    menuSectionsLoading,
    password,
    productDesc,
    productFlavors,
    productImage,
    productImageFile,
    productLongDesc,
    productName,
    productOptionGroups,
    productPrice,
    productSection,
    productSuccess,
    productToppingIds,
    promoError,
    promoListError,
    promoListLoading,
    promoMessage,
    promoSuccess,
    promoTitle,
    recentOrders,
    sectionCategory,
    sectionDesc,
    sectionImage,
    sectionName,
    sectionOrder,
    sectionSuccess,
    setActivePromos,
    setCarouselActive,
    setCarouselAltText,
    setCarouselCombos,
    setCarouselError,
    setCarouselImageFile,
    setCarouselItemsLoading,
    setCarouselLinkType,
    setCarouselLinkedId,
    setCarouselLoading,
    setCarouselOrder,
    setCarouselProducts,
    setCarouselSlides,
    setCarouselSuccess,
    setDeleteSectionTarget,
    setDeleteSlideTarget,
    setDeleteTarget,
    setDeleteToppingTarget,
    setEditingImageFile,
    setEditingItem,
    setEditingSection,
    setEditingSlide,
    setEditingSlideImageFile,
    setEditingTopping,
    setEmail,
    setError,
    setExpandedOrders,
    setIsAuthReady,
    setIsCarouselOpen,
    setIsMenuEditOpen,
    setIsMenuEditorOpen,
    setIsProductFormOpen,
    setIsPromoFormOpen,
    setIsSectionEditorOpen,
    setIsSectionFormOpen,
    setIsSubmitting,
    setIsToppingsOpen,
    setMenuError,
    setMenuItems,
    setMenuLoading,
    setMenuSavingId,
    setMenuSections,
    setMenuSectionsError,
    setMenuSectionsLoading,
    setPassword,
    setProductDesc,
    setProductFlavors,
    setProductImage,
    setProductImageFile,
    setProductLongDesc,
    setProductName,
    setProductOptionGroups,
    setProductPrice,
    setProductSection,
    setProductSuccess,
    setProductToppingIds,
    setPromoError,
    setPromoListError,
    setPromoListLoading,
    setPromoMessage,
    setPromoSuccess,
    setPromoTitle,
    setRecentOrders,
    setSectionCategory,
    setSectionDesc,
    setSectionImage,
    setSectionName,
    setSectionOrder,
    setSectionSuccess,
    setShowAllOrders,
    setStats,
    setStatsError,
    setStatsLoading,
    setToppingName,
    setToppingPrice,
    setToppingsError,
    setToppingsList,
    setToppingsLoading,
    setToppingsSuccess,
    setUser,
    showAllOrders,
    stats,
    statsError,
    statsLoading,
    toppingName,
    toppingPrice,
    toppingsError,
    toppingsList,
    toppingsLoading,
    toppingsSuccess,
    user
  }
}