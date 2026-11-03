import { BUSINESS } from './business'

// Everything the owner can change on the landing page (Admin → Landing).
// Stored in Firestore settings/landing; whatever isn't saved there yet uses
// these defaults. The page layout itself is fixed (Landing.jsx).
//
// Headings with a colored highlight are { pre, mark, post }: "Tu nuevo
// [plan favorito] en Tequixquiac."
//
// products / sections = null → chosen automatically from the live menu.

export const DEFAULT_LANDING = {
  business: {
    street: BUSINESS.street,
    landmark: BUSINESS.landmark,
    town: BUSINESS.town,
    instagram: BUSINESS.instagram,
    reviewUrl: BUSINESS.googleReviewUrl,
  },
  hours: { ...BUSINESS.hours, restNote: 'Descansamos' },
  // "Cerrado hoy": until = last closed day ("YYYY-MM-DD"), '' = open as usual.
  // Saved on its own the moment it's switched (not with "Publicar").
  closure: { until: '', message: '' },
  hero: {
    title: { pre: 'Tu nuevo', mark: 'plan favorito', post: `en ${BUSINESS.town}.` },
    text: 'Boba con tapioca, café y antojos hechos al momento. Ven con tus amigos, arma tu bebida y quédate un rato.',
    ctaMenu: 'Ver el menú',
    ctaVisit: 'Cómo llegar',
    caption: 'la que todos piden',
    products: null, // [left, middle, right] product docIds
  },
  ticker: ['Boba', 'Café', 'Frappes', 'Antojos', 'Hecho al momento', BUSINESS.town],
  plan: {
    title: { pre: 'Más que un café,', mark: 'es un plan.', post: '' },
    friends: { title: 'Ven con tu gente', text: 'Mesas para quedarse platicando y un pizarrón donde puedes dejar tu firma.', photo: '' },
    custom: { title: 'Hazla a tu manera', text: 'Base, sabor, toppings y extras. Tu bebida queda como la imaginaste.', cta: 'Armar la mía' },
    photo: { title: 'Tómale foto', text: 'Etiquétanos en', photo: '' },
    rewards: { big: '10%', title: 'Regresa por más', text: 'Cada compra te deja saldo para tu siguiente antojo.' },
  },
  flavors: {
    title: '¿De qué sabor eres hoy?',
    hint: 'Toca uno.',
    panel: 'Tu próxima boba',
    cta: 'Pedir la mía',
    hidden: [], // lowercase flavor names the owner hid
  },
  favorites: {
    title: { pre: 'Las que', mark: 'todos piden', post: '' },
    link: 'Ver todo el menú',
    products: null, // product docIds, up to MAX_FAVORITES
  },
  menu: {
    title: 'Para cada antojo',
    sections: null, // [{ id: section docId, cover: product docId | '' }]
  },
  order: {
    title: { pre: '¿Para llevar?', mark: 'Pide desde tu cel.', post: '' },
    text: 'Sin descargar nada y sin crear cuenta.',
    steps: [
      { title: 'Elige', text: 'Ve fotos y precios, y agrega lo que se te antoje.' },
      { title: 'Personaliza', text: 'Sabor, toppings y extras. El total se ajusta solo.' },
      { title: 'Envía', text: 'Tu pedido llega a nuestro WhatsApp y te lo confirmamos.' },
    ],
    cta: 'Empezar mi pedido',
  },
  visit: {
    title: { pre: 'Te vemos en', mark: 'Porfirio Díaz 18', post: '' },
    ctaMap: 'Cómo llegar',
    ctaChat: 'Escríbenos',
    review: '¿Ya viniste? Déjanos una reseña',
  },
  footer: {
    title: { pre: '¿Nos vemos', mark: 'hoy?', post: '' },
    ctaMenu: 'Ver el menú',
    ctaMap: 'Cómo llegar',
  },
  sticky: 'Ver el menú y pedir',
}

export const MAX_FAVORITES = 8
export const MAX_TICKER = 10

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Saved values over the defaults, keeping each field's type (a broken or
// missing field falls back to its default instead of breaking the page).
const mergeInto = (def, saved) => {
  if (saved === undefined) return def
  if (def === null) return Array.isArray(saved) ? saved : null
  if (isPlainObject(def)) {
    if (!isPlainObject(saved)) return def
    const out = {}
    for (const key of Object.keys(def)) out[key] = mergeInto(def[key], saved[key])
    return out
  }
  if (Array.isArray(def)) {
    if (!Array.isArray(saved)) return def
    // Lists of objects (order steps) keep their length and merge item by item.
    return isPlainObject(def[0]) ? def.map((d, i) => mergeInto(d, saved[i])) : saved
  }
  return typeof saved === typeof def ? saved : def
}

export const mergeLanding = (saved) => mergeInto(DEFAULT_LANDING, saved || {})

// "hero.title.mark" → value
export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

// Immutable set by path; numeric keys index into arrays ("ticker.2").
export const setPath = (obj, path, value) => {
  const [key, ...rest] = path.split('.')
  const next = rest.length ? setPath(obj?.[key] ?? (/^\d+$/.test(rest[0]) ? [] : {}), rest.join('.'), value) : value
  if (Array.isArray(obj)) {
    const copy = obj.slice()
    copy[Number(key)] = next
    return copy
  }
  return { ...obj, [key]: next }
}
