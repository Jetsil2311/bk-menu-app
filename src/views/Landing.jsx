/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { ArrowDown, ArrowRight, ArrowUp, Camera, Eye, EyeOff, Plus, Star } from 'lucide-react'
import { db } from '../firebase'
import Logo from '../assets/bklogo.svg'
import { useSections } from '../hooks/useSections'
import { useSettings } from '../hooks/useSettings'
import { useDrinkBuilder } from '../hooks/useDrinkBuilder'
import { useLandingContent } from '../hooks/useLandingContent'
import { DRINK_BUILDER_HASH } from '../utils/drinkBuilder'
import { productImage, hasImage, isPoster, isOnSale } from '../utils/productImage'
import { markReviewed } from '../utils/reviewPrompt'
import {
  BUSINESS, DAY_NAMES, whatsappUrl, mapsUrlFor, mapsEmbedUrlFor, instagramUrlFor, reviewUrlFor,
  daysLabel, closedDaysLabel, hoursLabelFor, openStatus, withPeriod,
} from '../config/business'
import { MAX_FAVORITES, MAX_TICKER } from '../config/landingContent'
import {
  LandingCtx, useLanding, T, HighlightTitle, Go, EditOnly, EditButton, RemoveButton, AddTile, PhotoControl,
} from '../components/landing/LandingEditable'

const IMG = (name) => `${import.meta.env.BASE_URL}landing/${name}.webp`

// Fallback photos, only if the live menu can't be read.
const FALLBACK_HERO = ['milky-taro', 'slushy', 'frappe-tapioca'].map((name) => ({ key: name, src: IMG(name), caption: '' }))

const PLAIN_FLAVOR = /^(cl[aá]sico|black|natural|sin sabor|original)$/i

// Every drink flavor on the live menu: all "Sabor(es)" option groups of
// drinks that are on sale, de-duplicated. Plain variants ("Clásico", "Black")
// aren't flavors to show off.
const flavorsFrom = (products, drinkSections) => {
  const seen = new Map()
  for (const p of products) {
    if (!isOnSale(p) || !drinkSections.has(p.section)) continue
    for (const g of p.optionGroups || []) {
      if (!/sabor/i.test(g.name || g.label || '')) continue
      for (const o of g.options || []) {
        const name = String(o.name || o.label || '').trim()
        if (!name || PLAIN_FLAVOR.test(name) || o.isActive === false) continue
        const key = name.toLowerCase()
        if (!seen.has(key)) seen.set(key, name)
      }
    }
  }
  return [...seen.values()]
}

const money = (n) => `$${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`

// Uploaded photos (Admin → Landing) come from Cloudinary; resize them like product photos.
const photoUrl = (url, transform) => productImage({ imageUrl: url }, transform)

// Candy color per flavor (Tailwind needs the full class names written out).
const TONES = {
  taro: 'bg-taro text-taro-ink',
  matcha: 'bg-matcha text-matcha-ink',
  mango: 'bg-mango text-mango-ink',
  fresa: 'bg-fresa text-fresa-ink',
  latte: 'bg-latte text-latte-ink',
}
const PEARL = { taro: 'bg-taro-ink', matcha: 'bg-matcha-ink', mango: 'bg-mango-ink', fresa: 'bg-fresa-ink', latte: 'bg-latte-ink' }
const TONE_ORDER = ['taro', 'matcha', 'mango', 'fresa', 'latte']
const FLAVOR_TONE = [
  [/taro|uva|blue|mora|lavanda|ube/i, 'taro'],
  [/matcha|kiwi|manzana|menta|pistach|lim[oó]n/i, 'matcha'],
  [/mango|maracuy|pi[ñn]a|vainilla|caramel|durazno|pl[aá]tano|coco/i, 'mango'],
  [/fresa|straw|frutos|sand[ií]a|lychee|rosa|frambuesa|cereza|dragon/i, 'fresa'],
]
const toneFor = (name, i) => FLAVOR_TONE.find(([re]) => re.test(name))?.[1] || TONE_ORDER[i % TONE_ORDER.length]

// Adds .is-visible to [data-reveal] elements once they scroll into view.
const useReveal = (deps) => {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]:not(.is-visible)'))
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-visible')); return undefined }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('is-visible')
        io.unobserve(e.target)
      })
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// The value, once it has stopped changing for `ms` (the map shouldn't reload on every keystroke).
const useSettled = (value, ms) => {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

const InstagramIcon = () => <i className="fa-brands fa-instagram text-[1.15em]" aria-hidden="true" />
const WhatsAppIcon = () => <i className="fa-brands fa-whatsapp text-[1.15em]" aria-hidden="true" />

const btnDark = 'inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-bold text-surface transition duration-300 hover:-translate-y-0.5 hover:bg-secondary active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30'
const btnHoney = 'inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-accent px-8 text-base font-bold text-ink transition duration-300 hover:-translate-y-0.5 hover:bg-light-300 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/50'
const btnGhost = 'inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border-2 border-primary/15 px-7 text-base font-bold text-primary transition-colors duration-300 hover:border-primary/40 hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20'
const h2Class = 'font-pop text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.035em] text-primary sm:text-6xl'
const fieldCls = 'mt-1.5 block min-h-[48px] w-full rounded-xl border-2 border-primary/15 bg-surface px-3.5 text-base text-ink outline-none transition focus:border-primary'

// A word with a tilted honey highlight behind it
const Highlight = ({ children, className = 'bg-accent' }) => (
  <span className="relative isolate inline-block whitespace-nowrap">
    <span className={`absolute -inset-x-[0.12em] bottom-[0.04em] top-[0.14em] -z-10 -rotate-[2deg] rounded-[0.28em] ${className}`} aria-hidden="true" />
    {children}
  </span>
)
const HoneyText = ({ children }) => <span className="text-accent">{children}</span>

// Little tapioca pearls that bob around a photo or panel
const Pearls = ({ spots, tone = 'bg-primary' }) => spots.map(([pos, size, delay], i) => (
  <span key={i} className={`pearl-bob pointer-events-none absolute rounded-full ${tone} ${pos}`} style={{ width: size, height: size, animationDelay: `${delay}s` }} aria-hidden="true" />
))

// Small note that only shows in the editor, explaining where something comes from.
const EditNote = ({ children, className = '' }) => (
  <EditOnly>
    <p className={`lp-control text-sm font-semibold text-ink-soft ${className}`}>{children}</p>
  </EditOnly>
)

// ── Editor-only: opening days and hours (feed "Abierto ahora" too) ─────────
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const HoursEditor = () => {
  const { content, editor } = useLanding()
  const { days, open, close } = content.hours
  const toggleDay = (d) => editor.set('hours.days', days.includes(d) ? days.filter((x) => x !== d) : [...days, d])
  const setTime = (key, value) => { if (value) editor.set(`hours.${key}`, value) }
  return (
    <div className="lp-control mt-8 rounded-2xl bg-bg p-5">
      <p className="font-bold text-ink" id="lp-days">Días que abrimos</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="lp-days">
        {WEEK.map((d) => {
          const on = days.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={DAY_NAMES[d]}
              onClick={() => toggleDay(d)}
              className={`h-11 min-w-[3.25rem] rounded-full border-2 px-3 text-sm font-bold transition-colors cursor-pointer ${on ? 'border-primary bg-primary text-surface' : 'border-primary/15 text-ink-soft hover:border-primary/40'}`}
            >
              {DAY_SHORT[d]}
            </button>
          )
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm font-bold text-ink">
          Abrimos
          <input type="time" value={open} onChange={(e) => setTime('open', e.target.value)} className={fieldCls} />
        </label>
        <label className="text-sm font-bold text-ink">
          Cerramos
          <input type="time" value={close} onChange={(e) => setTime('close', e.target.value)} className={fieldCls} />
        </label>
      </div>
      {close <= open && <p role="alert" className="mt-3 text-sm font-bold text-fresa-ink">La hora de cierre debe ser después de la de apertura.</p>}
      {days.length === 0 && <p role="alert" className="mt-3 text-sm font-bold text-fresa-ink">Elige al menos un día.</p>}
    </div>
  )
}

// ── Editor-only: details that aren't visible text (Google Maps, reseñas) ──
const BusinessFields = () => {
  const { content, editor } = useLanding()
  const b = content.business
  return (
    <div className="lp-control mt-6 grid gap-4 rounded-2xl border-2 border-dashed border-primary/20 p-5">
      <p className="font-bold text-ink">Datos para Google Maps y reseñas</p>
      <label className="text-sm font-bold text-ink">
        Calle y número
        <input value={b.street} onChange={(e) => editor.set('business.street', e.target.value)} className={fieldCls} autoComplete="off" />
        <span className="mt-1 block font-normal text-ink-soft">Con esto se arma el botón “Cómo llegar” y el mapa.</span>
      </label>
      <label className="text-sm font-bold text-ink">
        Instagram (sin @)
        <input value={b.instagram} onChange={(e) => editor.set('business.instagram', e.target.value.replace(/^@/, '').trim())} className={fieldCls} autoComplete="off" />
      </label>
      <label className="text-sm font-bold text-ink">
        Link para dejar reseña en Google
        <input type="url" inputMode="url" value={b.reviewUrl} placeholder="https://g.page/r/…/review" onChange={(e) => editor.set('business.reviewUrl', e.target.value.trim())} className={fieldCls} autoComplete="off" />
        <span className="mt-1 block font-normal text-ink-soft">En Google Business Profile → “Pedir reseñas”. Vacío = abre el café en Google Maps.</span>
      </label>
    </div>
  )
}

// The landing page. `content` = mergeLanding(...) (live or the editor's draft);
// `editor` = null on the real page, or the Admin → Landing editor API.
export const LandingPage = ({ content, editor = null }) => {
  const { sections, isLoading: sectionsLoading } = useSections()
  const { settings } = useSettings()
  const { config: builderConfig } = useDrinkBuilder()
  const [products, setProducts] = useState([])
  const [now, setNow] = useState(() => new Date())
  const [showStickyCta, setShowStickyCta] = useState(false)
  const [flavorIdx, setFlavorIdx] = useState(0)
  const [flavorTouched, setFlavorTouched] = useState(false)
  const heroRef = useRef(null)
  const editing = Boolean(editor)
  const biz = content.business

  // Live menu: prices and flavors always match what the café has today.
  useEffect(() => {
    let alive = true
    getDocs(collection(db, 'products'))
      .then((snap) => { if (alive) setProducts(snap.docs.map((d) => ({ docId: d.id, ...d.data() }))) })
      .catch(() => { /* the page still works with names only */ })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const status = useMemo(() => openStatus(now, content.hours, content.closure), [now, content.hours, content.closure])

  // Phone shortcut bar once the hero (and its button) scrolls away.
  useEffect(() => {
    if (editing || !heroRef.current || !('IntersectionObserver' in window)) return undefined
    const io = new IntersectionObserver(([e]) => setShowStickyCta(!e.isIntersecting), { threshold: 0 })
    io.observe(heroRef.current)
    return () => io.disconnect()
  }, [editing])

  // Page title + local-business data for Google (address and hours from Admin → Landing)
  useEffect(() => {
    if (editing) return undefined
    const prevTitle = document.title
    document.title = `${BUSINESS.name} · Boba y café en ${biz.town}`
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const ld = document.createElement('script')
    ld.type = 'application/ld+json'
    ld.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CafeOrCoffeeShop',
      name: BUSINESS.name,
      url: `${window.location.origin}/home`,
      image: `${window.location.origin}/landing/cafe-local.webp`,
      servesCuisine: ['Bubble tea', 'Café'],
      address: {
        '@type': 'PostalAddress',
        streetAddress: biz.street,
        addressLocality: biz.town,
        addressRegion: BUSINESS.state,
        addressCountry: BUSINESS.country,
      },
      openingHoursSpecification: [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: content.hours.days.map((d) => days[d]),
        opens: content.hours.open,
        closes: content.hours.close,
      }],
      sameAs: [instagramUrlFor(biz.instagram)],
      hasMenu: `${window.location.origin}/`,
    })
    document.head.appendChild(ld)
    return () => { document.title = prevTitle; ld.remove() }
  }, [editing, biz.street, biz.town, biz.instagram, content.hours])

  const byId = useMemo(() => new Map(products.map((p) => [p.docId, p])), [products])
  const drinkSections = useMemo(
    () => new Set(sections.filter((sec) => /bebida/i.test(sec.category || '')).map((sec) => sec.name)),
    [sections]
  )

  // Flavors the owner hid (Admin → Landing) aren't shown on the page.
  const allFlavors = useMemo(() => flavorsFrom(products, drinkSections), [products, drinkSections])
  const hiddenFlavors = useMemo(() => new Set(content.flavors.hidden.map((f) => String(f).toLowerCase())), [content.flavors.hidden])
  const flavors = useMemo(() => allFlavors.filter((f) => !hiddenFlavors.has(f.toLowerCase())), [allFlavors, hiddenFlavors])
  const flavorCount = flavors.length

  // The flavor panel changes by itself every few seconds until someone taps a flavor.
  useEffect(() => {
    if (editing || flavorTouched || flavorCount < 2 || prefersReducedMotion()) return undefined
    const t = setInterval(() => setFlavorIdx((i) => (i + 1) % flavorCount), 2600)
    return () => clearInterval(t)
  }, [editing, flavorTouched, flavorCount])

  // Products that can be shown with a photo (no promo posters, nothing sold out), in menu order.
  const photoProducts = useMemo(() => {
    const ordered = sections.flatMap((sec) => products.filter((p) => p.section === sec.name))
    return ordered.filter((p) => isOnSale(p) && hasImage(p) && !isPoster(p))
  }, [sections, products])
  // The first section is Nuestros Favoritos.
  const photoDrinks = useMemo(() => photoProducts.filter((p) => drinkSections.has(p.section)), [photoProducts, drinkSections])
  const usable = (id) => { const p = id && byId.get(id); return p && hasImage(p) ? p : null }

  // Hero: three drinks in tall capsules, the favourite in the middle. Each
  // slot is the owner's pick (Admin → Landing) or chosen automatically.
  const autoHero = useMemo(() => (photoDrinks.length >= 3 ? [photoDrinks[1], photoDrinks[0], photoDrinks[2]] : []), [photoDrinks])
  const heroCards = [0, 1, 2].map((i) => {
    const p = usable(content.hero.products?.[i]) || autoHero[i]
    return p
      ? { key: `${i}-${p.docId}`, src: productImage(p, 'c_fill,g_auto,ar_9:16,w_480,f_auto,q_auto'), caption: p.name }
      : FALLBACK_HERO[i]
  })

  // "Las que todos piden": the owner's list, or the first section with photos (four).
  const autoFavorites = useMemo(() => {
    const first = photoDrinks[0]?.section
    return photoDrinks.filter((p) => p.section === first).slice(0, 4)
  }, [photoDrinks])
  const favoriteIds = content.favorites.products ?? autoFavorites.map((p) => p.docId)
  const favorites = favoriteIds.map(usable).filter(Boolean)

  // "Para cada antojo": the owner's list of menu sections ({ id, cover }).
  // Not set yet → the old per-section switches from Menú → Editar sección.
  const sectionEntries = content.menu.sections
    ?? sections.filter((sec) => sec.showOnLanding !== false).map((sec) => ({ id: sec.docId, cover: sec.coverProductId || '' }))
  const sectionById = useMemo(() => new Map(sections.map((sec) => [sec.docId, sec])), [sections])
  const heroKeys = new Set(heroCards.map((c) => c.key.split('-').slice(1).join('-')))
  const landingSections = sectionEntries
    .map((entry) => {
      const sec = sectionById.get(entry.id)
      if (!sec) return null
      const all = products.filter((p) => p.section === sec.name)
      const items = all.filter(isOnSale)
      const prices = items.map((p) => Number(p.price)).filter((n) => n > 0)
      const chosen = entry.cover ? all.find((p) => p.docId === entry.cover && hasImage(p)) : null
      const photos = items.filter((p) => hasImage(p) && !isPoster(p))
      return {
        entry,
        sec,
        photos,
        from: prices.length ? Math.min(...prices) : null,
        cover: chosen || photos.find((p) => !heroKeys.has(p.docId)) || photos[0] || null,
      }
    })
    .filter(Boolean)

  // Photo for "Tómale foto": the owner's upload, or a favourite that isn't already big in the hero.
  const photoCard = photoDrinks[3] || photoDrinks[0] || null
  const photoTileSrc = content.plan.photo.photo
    ? photoUrl(content.plan.photo.photo, 'c_fill,g_auto,w_600,h_700,f_auto,q_auto')
    : photoCard && productImage(photoCard, 'c_fill,g_auto,w_600,h_700,f_auto,q_auto')
  const friendsSrc = content.plan.friends.photo ? photoUrl(content.plan.friends.photo, 'c_fill,g_auto,w_1200,h_1200,f_auto,q_auto') : IMG('cafe-local')

  const waNumber = settings?.orderNotificationPhone
  const mapsUrl = mapsUrlFor(biz)
  const mapEmbed = useSettled(mapsEmbedUrlFor(biz), editing ? 1200 : 0)
  const reviewUrl = reviewUrlFor(biz)
  const instagramUrl = instagramUrlFor(biz.instagram)
  const flavor = flavors[flavorIdx % Math.max(flavorCount, 1)] || ''
  const flavorTone = toneFor(flavor, flavorIdx)
  const pickFlavor = (i) => { setFlavorTouched(true); setFlavorIdx(i) }
  const ticker = content.ticker.filter((w) => String(w).trim())
  const openDaysText = daysLabel(content.hours.days)
  const hasRestDays = content.hours.days.length < 7

  useReveal([sectionsLoading, flavorCount, favorites.length, landingSections.length, Boolean(builderConfig)])

  // ── Editor actions (lists and photos) ────────────────────────────────────
  const pickHero = (i) => editor.pickProduct({
    title: ['Bebida de la izquierda', 'Bebida de en medio', 'Bebida de la derecha'][i],
    options: photoDrinks,
    allowAuto: true,
    selected: content.hero.products?.[i] || '',
    onPick: (id) => {
      const ids = content.hero.products ? [...content.hero.products] : ['', '', '']
      ids[i] = id
      editor.set('hero.products', ids.every((x) => !x) ? null : ids)
    },
  })
  const addFavorite = () => editor.pickProduct({
    title: 'Agregar a “Las que todos piden”',
    options: photoProducts.filter((p) => !favoriteIds.includes(p.docId)),
    onPick: (id) => editor.set('favorites.products', [...favoriteIds, id]),
  })
  const removeFavorite = (id) => editor.set('favorites.products', favoriteIds.filter((x) => x !== id))
  const setSections = (list) => editor.set('menu.sections', list)
  const moveSection = (i, dir) => {
    const list = [...sectionEntries]
    const [item] = list.splice(i, 1)
    list.splice(i + dir, 0, item)
    setSections(list)
  }
  const addSection = () => editor.pickSection({
    options: sections.filter((sec) => !sectionEntries.some((e) => e.id === sec.docId)),
    onPick: (id) => setSections([...sectionEntries, { id, cover: '' }]),
  })
  const pickCover = (i, row) => editor.pickProduct({
    title: `Foto de “${row.sec.name}”`,
    options: row.photos,
    allowAuto: true,
    selected: row.entry.cover,
    onPick: (id) => setSections(sectionEntries.map((e, j) => (j === i ? { ...e, cover: id } : e))),
  })
  const toggleFlavor = (f) => {
    const key = f.toLowerCase()
    const hidden = content.flavors.hidden.filter((x) => String(x).toLowerCase() !== key)
    editor.set('flavors.hidden', hiddenFlavors.has(key) ? hidden : [...hidden, key])
  }

  const page = (
    <div className={`min-h-dvh overflow-x-clip bg-bg font-landing text-ink antialiased ${editing ? 'lp-editing' : ''}`}>
      {!editing && (
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:font-bold">
          Saltar al contenido
        </a>
      )}

      {/* ── "Cerrado hoy" (Admin → Landing) ────────────────────────────── */}
      {status.closedToday && (
        <div role="status" className="bg-fresa text-fresa-ink">
          <p className="mx-auto flex max-w-6xl items-start gap-3 px-5 py-3.5 text-[0.95rem] font-semibold sm:px-8">
            <span className="mt-[0.45em] h-2.5 w-2.5 shrink-0 rounded-full bg-fresa-ink" aria-hidden="true" />
            <span>
              <span className="font-extrabold">{withPeriod(status.text)}</span>
              {content.closure.message && <> {content.closure.message}</>}
            </span>
          </p>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header ref={heroRef} className="relative isolate">
        <nav aria-label="Principal" className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Go to="/home" aria-label={`${BUSINESS.name}, inicio`} className="rounded-full bg-primary px-4 py-2">
            <img src={Logo} alt={BUSINESS.name} className="h-8 sm:h-9" />
          </Go>
          <div className="flex items-center gap-1 sm:gap-2">
            <Go href="#el-plan" className="hidden min-h-[44px] items-center rounded-full px-4 text-[0.95rem] font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-primary md:inline-flex">El plan</Go>
            <Go href="#sabores" className="hidden min-h-[44px] items-center rounded-full px-4 text-[0.95rem] font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-primary md:inline-flex">Sabores</Go>
            <Go href="#visitanos" className="hidden min-h-[44px] items-center rounded-full px-4 text-[0.95rem] font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-primary md:inline-flex">Visítanos</Go>
            <Go to="/" className="ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-5 text-[0.95rem] font-bold text-surface transition-colors duration-300 hover:bg-secondary">
              Pedir <ArrowRight size={16} aria-hidden="true" />
            </Go>
          </div>
        </nav>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-6 sm:px-8 md:grid-cols-[1.05fr_0.95fr] md:gap-8 md:pb-24 md:pt-12">
          <div className="text-center md:text-left">
            <p className="rise-in inline-flex items-center gap-2.5 text-sm font-semibold text-ink-soft">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                {status.open && <span className="absolute inset-0 animate-ping rounded-full bg-matcha-ink/50" />}
                <span className={`relative h-2.5 w-2.5 rounded-full ${status.open ? 'bg-matcha-ink' : 'bg-ink-soft/40'}`} />
              </span>
              {status.text}
            </p>
            <h1 className="rise-in mt-5 font-pop text-[3.3rem] font-extrabold leading-[0.92] tracking-[-0.045em] text-primary sm:text-[4.6rem] lg:text-[5.2rem]" style={{ animationDelay: '80ms' }}>
              <HighlightTitle k="hero.title" label="Título principal" Highlight={Highlight} />
            </h1>
            <p className="rise-in mx-auto mt-6 max-w-[30rem] text-lg leading-relaxed text-ink-soft md:mx-0" style={{ animationDelay: '160ms' }}>
              <T k="hero.text" label="Texto debajo del título" />
            </p>
            <div className="rise-in mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start" style={{ animationDelay: '240ms' }}>
              <Go to="/" className={btnDark}>
                <T k="hero.ctaMenu" label="Botón principal" req /> <ArrowRight size={18} aria-hidden="true" />
              </Go>
              <Go href="#visitanos" className={btnGhost}><T k="hero.ctaVisit" label="Segundo botón" req /></Go>
            </div>
          </div>

          {/* Three drinks in tall capsules, each on its own candy color */}
          <div className="relative mx-auto w-full max-w-[26rem] md:max-w-[34rem]" aria-hidden={editing ? undefined : 'true'}>
            <div className="grid grid-cols-3 items-center gap-3 sm:gap-4">
              {heroCards.map((card, i) => (
                <div
                  key={card.key}
                  className={`rise-in relative rounded-full p-1.5 sm:p-2 ${['bg-taro', 'bg-mango', 'bg-fresa'][i]} ${i === 1 ? '' : 'mt-14'}`}
                  style={{ animationDelay: `${200 + i * 110}ms` }}
                >
                  <img src={card.src} alt="" width="240" height="427" className="aspect-[9/16] w-full rounded-full bg-latte object-cover" />
                  <EditOnly>
                    <EditButton
                      icon={Camera}
                      label={`Cambiar ${['bebida de la izquierda', 'bebida de en medio', 'bebida de la derecha'][i]}`}
                      onClick={() => pickHero(i)}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3"
                    />
                  </EditOnly>
                </div>
              ))}
            </div>
            {heroCards[1]?.caption && (
              <p className="rise-in mt-5 text-center text-sm font-semibold text-ink-soft" style={{ animationDelay: '560ms' }}>
                En medio: <span className="text-primary">{heroCards[1].caption}</span>, <T k="hero.caption" label="Texto bajo las bebidas" />
              </p>
            )}
            <EditNote className="mt-3 text-center">Toca la cámara de cada bebida para elegir cuál sale.</EditNote>
          </div>
        </div>

        {/* Ticker */}
        {editing ? (
          <div className="bg-primary px-5 py-5 text-accent sm:px-8">
            <ul className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
              {content.ticker.map((w, i) => (
                <li key={i} className="flex items-center gap-1 rounded-full bg-espresso/30 py-1 pl-4 pr-1 font-pop text-xl font-extrabold uppercase tracking-[-0.02em]">
                  <T k={`ticker.${i}`} label={`Palabra ${i + 1} de la franja`} />
                  <RemoveButton label="Quitar palabra" onClick={() => editor.set('ticker', content.ticker.filter((_, j) => j !== i))} className="h-9 w-9" />
                </li>
              ))}
              {content.ticker.length < MAX_TICKER && (
                <li>
                  <EditButton icon={Plus} onClick={() => editor.set('ticker', [...content.ticker, 'Nueva'])}>Agregar palabra</EditButton>
                </li>
              )}
            </ul>
          </div>
        ) : ticker.length > 0 && (
          <div className="marquee overflow-hidden bg-primary py-4 text-accent" aria-hidden="true">
            <ul className="marquee-track flex w-max items-center">
              {Array(2).fill(ticker).flat().map((w, i) => (
                <li key={i} data-dup={i >= ticker.length ? '' : undefined} className="flex shrink-0 items-center font-pop text-2xl font-extrabold uppercase tracking-[-0.02em] sm:text-3xl">
                  <span className="px-6">{w}</span>
                  <span className="h-3 w-3 rounded-full bg-accent" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <main id="contenido">
        {/* ── The experience ──────────────────────────────────────────── */}
        <section id="el-plan" aria-labelledby="el-plan-title" className="mx-auto max-w-6xl scroll-mt-6 px-5 pt-20 sm:px-8 sm:pt-28">
          <h2 id="el-plan-title" data-reveal className={`reveal max-w-2xl ${h2Class}`}>
            <HighlightTitle k="plan.title" label="Título de El plan" Highlight={Highlight} markClass="bg-taro" />
          </h2>

          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 md:grid-rows-[repeat(2,minmax(15rem,auto))]">
            {/* Friends */}
            <article data-reveal className="reveal group relative col-span-2 min-h-[24rem] overflow-hidden rounded-[2rem] bg-latte md:row-span-2">
              <img
                src={friendsSrc}
                alt="El interior de Bubble Kaapeh: pizarrón con el logo, mesas de madera y la barra"
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-espresso/85 via-espresso/10 to-transparent" aria-hidden="true" />
              <PhotoControl k="plan.friends.photo" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-surface sm:p-8">
                <h3 className="font-pop text-3xl font-extrabold leading-none tracking-[-0.03em] sm:text-4xl"><T k="plan.friends.title" label="Título de la tarjeta grande" /></h3>
                <p className="mt-2 max-w-sm text-surface/85"><T k="plan.friends.text" label="Texto de la tarjeta grande" /></p>
              </div>
            </article>

            {/* Make it yours */}
            <article data-reveal style={{ transitionDelay: '80ms' }} className="reveal relative col-span-2 flex flex-col justify-between overflow-hidden rounded-[2rem] bg-taro p-6 text-taro-ink sm:p-8">
              <Pearls spots={[['right-8 top-8', 26, 0], ['right-20 top-16', 16, 0.9], ['right-12 top-28', 20, 1.6]]} tone="bg-taro-ink" />
              <h3 className="relative max-w-[14rem] font-pop text-3xl font-extrabold leading-none tracking-[-0.03em] sm:text-4xl"><T k="plan.custom.title" label="Título de Hazla a tu manera" /></h3>
              <div className="relative mt-8">
                <p className="max-w-sm"><T k="plan.custom.text" label="Texto de Hazla a tu manera" /></p>
                <Go to={builderConfig ? `/${DRINK_BUILDER_HASH}` : '/'} className="mt-4 inline-flex min-h-[44px] items-center gap-2 font-bold underline decoration-2 underline-offset-4">
                  <T k="plan.custom.cta" label="Enlace de Hazla a tu manera" req /> <ArrowRight size={17} aria-hidden="true" />
                </Go>
              </div>
            </article>

            {/* Photo-worthy */}
            <article data-reveal style={{ transitionDelay: '160ms' }} className="reveal group relative min-h-[15rem] overflow-hidden rounded-[2rem] bg-fresa">
              {photoTileSrc && (
                <img src={photoTileSrc} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-espresso/80 to-transparent" aria-hidden="true" />
              <PhotoControl k="plan.photo.photo" className="absolute inset-x-3 top-3 z-10 flex-wrap" />
              <Go href={instagramUrl} external className="absolute inset-x-0 bottom-0 block p-5 text-surface focus-visible:outline-none">
                <h3 className="font-pop text-2xl font-extrabold leading-none tracking-[-0.03em]"><T k="plan.photo.title" label="Título de Tómale foto" /></h3>
                <p className="mt-1.5 text-sm text-surface/85"><T k="plan.photo.text" label="Texto de Tómale foto" /> @{biz.instagram}</p>
              </Go>
            </article>

            {/* Rewards */}
            <article data-reveal style={{ transitionDelay: '240ms' }} className="reveal flex min-h-[15rem] flex-col justify-between rounded-[2rem] bg-mango p-5 text-mango-ink sm:p-6">
              <p className="font-pop text-[4.2rem] font-extrabold leading-[0.85] tracking-[-0.05em] sm:text-7xl"><T k="plan.rewards.big" label="Número grande de recompensas" /></p>
              <div>
                <h3 className="font-pop text-xl font-extrabold leading-tight tracking-[-0.02em]"><T k="plan.rewards.title" label="Título de recompensas" /></h3>
                <p className="mt-1 text-sm"><T k="plan.rewards.text" label="Texto de recompensas" /></p>
              </div>
            </article>
          </div>
        </section>

        {/* ── Flavor picker ───────────────────────────────────────────── */}
        {allFlavors.length > 0 && (editing || flavorCount > 0) && (
          <section id="sabores" aria-labelledby="sabores-title" className="mx-auto max-w-6xl scroll-mt-6 px-5 pt-20 sm:px-8 sm:pt-28">
            <div data-reveal className="reveal flex flex-wrap items-end justify-between gap-4">
              <h2 id="sabores-title" className={`max-w-[12ch] ${h2Class}`}><T k="flavors.title" label="Título de sabores" /></h2>
              <p className="text-lg font-semibold text-ink-soft">{flavorCount >= 5 && `${flavorCount} sabores. `}<T k="flavors.hint" label="Indicación de sabores" /></p>
            </div>

            <div data-reveal className="reveal mt-8">
              <div className={`relative flex min-h-[19rem] flex-col justify-between overflow-hidden rounded-[2.5rem] p-7 transition-colors duration-500 sm:min-h-[22rem] sm:p-12 ${TONES[flavorTone]}`}>
                <Pearls
                  spots={[['right-[8%] bottom-[18%]', 34, 0], ['right-[18%] bottom-[30%]', 22, 0.7], ['right-[12%] bottom-[44%]', 28, 1.3], ['right-[26%] bottom-[14%]', 18, 2]]}
                  tone={PEARL[flavorTone]}
                />
                <p className="relative text-base font-semibold opacity-80"><T k="flavors.panel" label="Texto sobre el sabor" /></p>
                <p key={flavor} aria-live="polite" className="flavor-pop relative max-w-[80%] break-words font-pop text-[3.6rem] font-extrabold leading-[0.9] tracking-[-0.05em] sm:text-8xl lg:text-[8.5rem]">
                  {flavor}
                </p>
                <Go to="/" className="relative mt-6 inline-flex min-h-[48px] w-fit items-center gap-2 rounded-full bg-surface/80 px-6 font-bold text-ink transition-colors hover:bg-surface">
                  <T k="flavors.cta" label="Botón de sabores" req /> <ArrowRight size={17} aria-hidden="true" />
                </Go>
              </div>
            </div>

            {editing ? (
              <>
                <EditNote className="mt-5">Los sabores salen solos del menú. Toca uno para ocultarlo o volver a mostrarlo.</EditNote>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Sabores que se muestran">
                  {allFlavors.map((f) => {
                    const shown = !hiddenFlavors.has(f.toLowerCase())
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={shown}
                        onClick={() => toggleFlavor(f)}
                        className={`lp-control inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 px-4 text-[0.95rem] font-semibold transition-colors cursor-pointer ${shown ? 'border-primary/40 text-primary' : 'border-dashed border-primary/20 text-ink-soft/70 line-through'}`}
                      >
                        {shown ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />} {f}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Sabores">
                {flavors.map((f, i) => {
                  const on = i === flavorIdx % flavorCount
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickFlavor(i)}
                      className={`min-h-[44px] cursor-pointer rounded-full border-2 px-4 text-[0.95rem] font-semibold transition duration-200 active:scale-95 ${on ? 'border-primary bg-primary text-surface' : 'border-primary/15 text-ink-soft hover:border-primary/40 hover:text-primary'}`}
                    >
                      {f}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Favourites ──────────────────────────────────────────────── */}
        {(editing || favorites.length >= 2) && (
          <section aria-labelledby="favoritas" className="pt-20 sm:pt-28">
            <div data-reveal className="reveal mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5 sm:px-8">
              <h2 id="favoritas" className={h2Class}>
                <HighlightTitle k="favorites.title" label="Título de favoritas" Highlight={Highlight} markClass="bg-mango" />
              </h2>
              <Go to="/" className="inline-flex min-h-[44px] items-center gap-2 font-bold text-primary underline decoration-2 underline-offset-4">
                <T k="favorites.link" label="Enlace de favoritas" req /> <ArrowRight size={17} aria-hidden="true" />
              </Go>
            </div>
            <EditNote className="mx-auto mt-4 max-w-6xl px-5 sm:px-8">El nombre, la foto y el precio salen del menú.</EditNote>
            <ul className="scrollbar-hide mx-auto mt-10 flex max-w-6xl snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:px-8 md:grid md:grid-cols-4 md:overflow-visible">
              {favorites.map((p, i) => {
                const tone = TONE_ORDER[i % TONE_ORDER.length]
                return (
                  <li key={p.docId} className="relative w-[72%] shrink-0 snap-start sm:w-[45%] md:w-auto">
                    <Go to="/" className={`group block rounded-[2rem] p-3 transition duration-300 hover:-translate-y-1 hover:-rotate-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ${TONES[tone]}`}>
                      <div className="overflow-hidden rounded-[1.5rem] bg-latte">
                        <img
                          src={productImage(p, 'c_fill,g_auto,ar_4:5,w_600,f_auto,q_auto')}
                          alt={p.name}
                          loading="lazy"
                          width="300"
                          height="375"
                          className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                        />
                      </div>
                      <div className="flex items-end justify-between gap-3 px-2 pb-2 pt-4">
                        <div className="min-w-0">
                          <h3 className="font-pop text-xl font-extrabold leading-tight tracking-[-0.02em]">{p.name}</h3>
                          {p.desc && <p className="mt-0.5 truncate text-sm opacity-80">{p.desc}</p>}
                        </div>
                        {Number(p.price) > 0 && <span className="shrink-0 font-pop text-xl font-extrabold">{money(p.price)}</span>}
                      </div>
                    </Go>
                    <EditOnly>
                      <RemoveButton label={`Quitar ${p.name}`} onClick={() => removeFavorite(p.docId)} className="absolute right-5 top-5" />
                    </EditOnly>
                  </li>
                )
              })}
              {editing && favorites.length < MAX_FAVORITES && (
                <li className="w-[72%] shrink-0 snap-start sm:w-[45%] md:w-auto">
                  <AddTile onClick={addFavorite} className="h-full min-h-[14rem]">Agregar bebida</AddTile>
                </li>
              )}
            </ul>
          </section>
        )}

        {/* ── The whole menu (live sections) ──────────────────────────── */}
        {(editing || sectionsLoading || landingSections.length > 0) && (
          <section aria-labelledby="carta-title" className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
            <h2 id="carta-title" data-reveal className={`reveal ${h2Class}`}><T k="menu.title" label="Título de secciones" /></h2>
            <ul className="mt-8 grid gap-3 md:grid-cols-2">
              {sectionsLoading && sections.length === 0
                ? [0, 1, 2, 3].map((i) => <li key={i} className="h-24 animate-pulse rounded-[1.75rem] bg-latte/50" />)
                : landingSections.map((row, i) => {
                  const { sec, from, cover } = row
                  const tone = TONE_ORDER[i % TONE_ORDER.length]
                  return (
                    <li key={sec.docId} data-reveal className="reveal" style={{ transitionDelay: `${Math.min(i * 60, 240)}ms` }}>
                      <Go
                        to={sec.category ? `/${sec.category.toLowerCase()}` : '/'}
                        className="group flex items-center gap-4 rounded-[1.75rem] bg-surface p-3 pr-5 shadow-[0_14px_30px_-26px_var(--color-ink)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-24px_var(--color-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                      >
                        <span className={`h-20 w-20 shrink-0 overflow-hidden rounded-[1.25rem] ${TONES[tone]}`}>
                          {cover && <img src={productImage(cover, 'c_fill,g_auto,w_200,h_200,f_auto,q_auto')} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-pop text-xl font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-2xl">{sec.name}</span>
                          {from != null && <span className="mt-0.5 block text-sm text-ink-soft">desde <span className="font-bold text-ink">{money(from)}</span></span>}
                        </span>
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-1 ${TONES[tone]}`} aria-hidden="true">
                          <ArrowRight size={18} />
                        </span>
                      </Go>
                      <EditOnly>
                        <div className="mt-2 flex flex-wrap gap-2 px-1">
                          <EditButton icon={Camera} onClick={() => pickCover(i, row)} disabled={!row.photos.length}>Foto</EditButton>
                          <EditButton icon={ArrowUp} label={`Subir ${sec.name}`} onClick={() => moveSection(i, -1)} disabled={i === 0} className="px-3" />
                          <EditButton icon={ArrowDown} label={`Bajar ${sec.name}`} onClick={() => moveSection(i, 1)} disabled={i === landingSections.length - 1} className="px-3" />
                          <RemoveButton label={`Quitar ${sec.name} de la página`} onClick={() => setSections(sectionEntries.filter((e) => e.id !== sec.docId))} />
                        </div>
                      </EditOnly>
                    </li>
                  )
                })}
              {editing && !sectionsLoading && landingSections.length < sections.length && (
                <li><AddTile onClick={addSection} className="min-h-[6.5rem]">Agregar sección del menú</AddTile></li>
              )}
            </ul>
            <EditNote className="mt-4">Cada sección lleva a su parte del menú. El nombre y el precio “desde” salen del menú.</EditNote>
          </section>
        )}

        {/* ── How ordering works ──────────────────────────────────────── */}
        <section aria-labelledby="como-pedir" className="mx-auto max-w-6xl px-5 pt-20 sm:px-8 sm:pt-28">
          <div data-reveal className="reveal max-w-2xl">
            <h2 id="como-pedir" className={h2Class}>
              <HighlightTitle k="order.title" label="Título de cómo pedir" Highlight={Highlight} markClass="bg-matcha" />
            </h2>
            <p className="mt-4 text-lg text-ink-soft"><T k="order.text" label="Texto de cómo pedir" /></p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {['bg-taro text-taro-ink', 'bg-mango text-mango-ink', 'bg-fresa text-fresa-ink'].map((tone, i) => (
              <li key={tone} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className={`reveal rounded-[2rem] p-6 sm:p-7 ${tone}`}>
                <span className="font-pop text-6xl font-extrabold leading-none tracking-[-0.05em] opacity-90" aria-hidden="true">0{i + 1}</span>
                <h3 className="mt-6 font-pop text-2xl font-extrabold tracking-[-0.02em]"><T k={`order.steps.${i}.title`} label={`Paso ${i + 1}: título`} /></h3>
                <p className="mt-1.5 leading-relaxed"><T k={`order.steps.${i}.text`} label={`Paso ${i + 1}: texto`} /></p>
              </li>
            ))}
          </ol>
          <Go to="/" className={`${btnDark} mt-8 w-full sm:w-auto`}>
            <T k="order.cta" label="Botón de cómo pedir" req /> <ArrowRight size={18} aria-hidden="true" />
          </Go>
        </section>

        {/* ── Visit ───────────────────────────────────────────────────── */}
        <section id="visitanos" aria-labelledby="visitanos-title" className="mx-auto max-w-6xl scroll-mt-6 px-5 pt-20 sm:px-8 sm:pt-28">
          <div data-reveal className="reveal overflow-hidden rounded-[2.5rem] bg-surface shadow-[0_24px_50px_-36px_var(--color-ink)] md:grid md:grid-cols-[1fr_1fr]">
            <div className="p-7 sm:p-12">
              <h2 id="visitanos-title" className={h2Class}>
                <HighlightTitle k="visit.title" label="Título de visítanos" Highlight={Highlight} markClass="bg-fresa" />
              </h2>
              <p className="mt-4 text-lg text-ink-soft"><T k="business.landmark" label="Referencia" />, <T k="business.town" label="Pueblo o ciudad" />.</p>

              {editing ? <HoursEditor /> : (
                <dl className="mt-8 grid gap-3">
                  {openDaysText && (
                    <div className="flex items-baseline justify-between gap-4 rounded-2xl bg-bg px-5 py-4">
                      <dt className="font-bold text-ink">{openDaysText}</dt>
                      <dd className="text-right text-ink-soft">{hoursLabelFor(content.hours)}</dd>
                    </div>
                  )}
                  {hasRestDays && (
                    <div className="flex items-baseline justify-between gap-4 rounded-2xl bg-bg px-5 py-4">
                      <dt className="font-bold text-ink">{closedDaysLabel(content.hours.days)}</dt>
                      <dd className="text-right text-ink-soft"><T k="hours.restNote" req /></dd>
                    </div>
                  )}
                </dl>
              )}
              {editing && hasRestDays && (
                <p className="mt-3 text-ink-soft">
                  {closedDaysLabel(content.hours.days)}: <T k="hours.restNote" label="Texto de los días que no abrimos" />
                </p>
              )}
              <p className="mt-4 flex items-center gap-2.5 text-sm font-semibold text-ink-soft">
                <span className={`h-2.5 w-2.5 rounded-full ${status.open ? 'bg-matcha-ink' : 'bg-ink-soft/40'}`} aria-hidden="true" />
                {status.text}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Go href={mapsUrl} external className={btnDark}>
                  <T k="visit.ctaMap" label="Botón de cómo llegar" req /> <ArrowRight size={18} aria-hidden="true" />
                </Go>
                <Go href={whatsappUrl(waNumber, '¡Hola! ')} external className={btnGhost}>
                  <WhatsAppIcon /> <T k="visit.ctaChat" label="Botón de WhatsApp" req />
                </Go>
              </div>
              <Go href={reviewUrl} external onClick={markReviewed} className="mt-5 inline-flex min-h-[44px] items-center gap-2 font-bold text-primary underline decoration-2 underline-offset-4">
                <Star size={16} className="fill-current" aria-hidden="true" /> <T k="visit.review" label="Enlace de reseña" req />
              </Go>
              <EditOnly><BusinessFields /></EditOnly>
            </div>
            <iframe
              title={`Mapa: ${BUSINESS.name} en ${biz.street}, ${biz.town}`}
              src={mapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="landing-map block h-80 w-full border-0 md:h-full md:min-h-[32rem]"
            />
          </div>
        </section>
      </main>

      {/* ── Last call + footer ─────────────────────────────────────────── */}
      <footer className="relative mt-24 overflow-hidden bg-primary pb-28 pt-20 text-surface sm:mt-32 sm:pb-12 sm:pt-24">
        <Pearls spots={[['right-[10%] top-16', 40, 0], ['right-[22%] top-32', 24, 0.8], ['right-[6%] top-44', 30, 1.5]]} tone="bg-espresso/60" />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div data-reveal className="reveal max-w-3xl">
            <p className="font-pop text-[3.4rem] font-extrabold leading-[0.9] tracking-[-0.045em] sm:text-8xl">
              <HighlightTitle k="footer.title" label="Frase final" Highlight={HoneyText} />
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Go to="/" className={btnHoney}>
                <T k="footer.ctaMenu" label="Botón final del menú" req /> <ArrowRight size={18} aria-hidden="true" />
              </Go>
              <Go href={mapsUrl} external className="inline-flex min-h-[54px] items-center justify-center rounded-full border-2 border-surface/25 px-7 font-bold text-surface transition-colors hover:border-surface/60">
                <T k="footer.ctaMap" label="Botón final de cómo llegar" req />
              </Go>
            </div>
          </div>

          <div className="mt-20 flex flex-col gap-8 border-t border-surface/15 pt-10 md:flex-row md:items-end md:justify-between">
            <div>
              <img src={Logo} alt={BUSINESS.name} className="h-11" />
              <p className="mt-3 text-sm text-surface/65">{biz.street} · {biz.landmark} · {biz.town}</p>
            </div>
            <nav aria-label="Enlaces" className="flex flex-wrap gap-x-6 text-sm font-semibold text-surface/85">
              <Go to="/" className="inline-flex min-h-[44px] items-center hover:text-surface">Menú</Go>
              <Go href={instagramUrl} external className="inline-flex min-h-[44px] items-center gap-2 hover:text-surface"><InstagramIcon /> @{biz.instagram}</Go>
              <Go href={whatsappUrl(waNumber, '¡Hola! ')} external className="inline-flex min-h-[44px] items-center gap-2 hover:text-surface"><WhatsAppIcon /> WhatsApp</Go>
              <Go href={reviewUrl} external onClick={markReviewed} className="inline-flex min-h-[44px] items-center gap-2 hover:text-surface"><Star size={15} className="fill-current" aria-hidden="true" /> Reseña en Google</Go>
            </nav>
          </div>
          <div className="mt-6 flex items-center justify-between gap-4 text-xs text-surface/50">
            <p>© {new Date().getFullYear()} {BUSINESS.name}</p>
            <Go to="/admin" className="inline-flex min-h-[44px] items-center hover:text-surface">Acceso del equipo</Go>
          </div>
        </div>
      </footer>

      {/* ── Phone shortcut once the hero is gone ───────────────────────── */}
      {editing ? (
        <div className="lp-control bg-bg px-5 py-6 sm:px-8">
          <p className="mx-auto max-w-6xl text-sm font-semibold text-ink-soft">Botón que aparece abajo en celulares al bajar por la página:</p>
          <span className={`${btnHoney} mx-auto mt-3 flex w-full max-w-sm`}>
            <T k="sticky" label="Botón fijo en celulares" /> <ArrowRight size={18} aria-hidden="true" />
          </span>
        </div>
      ) : (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-transform duration-300 sm:hidden ${showStickyCta ? 'translate-y-0' : 'translate-y-[120%]'}`}
          aria-hidden={!showStickyCta}
        >
          <Go to="/" tabIndex={showStickyCta ? 0 : -1} className={`${btnHoney} w-full shadow-[0_16px_32px_-12px_var(--color-espresso)]`}>
            <T k="sticky" req /> <ArrowRight size={18} aria-hidden="true" />
          </Go>
        </div>
      )}
    </div>
  )

  return <LandingCtx.Provider value={{ content, editor }}>{page}</LandingCtx.Provider>
}

export const Landing = () => {
  const { content, loading } = useLandingContent()
  // Wait briefly for the owner's saved text so the default copy doesn't flash first.
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 1200)
    return () => clearTimeout(t)
  }, [])
  if (loading && !waited) return <div className="min-h-dvh bg-bg" aria-busy="true" />
  return <LandingPage content={content} />
}
