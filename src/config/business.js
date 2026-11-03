// Business facts shown on the landing page (and its search-engine data).
// These are the defaults: the owner edits the live values in
// Admin → Landing (Firestore settings/landing, see config/landingContent.js).

export const BUSINESS = {
  name: 'Bubble Kaapeh',
  street: 'Calle Porfirio Díaz 18',
  landmark: 'Junto a Banco Azteca',
  town: 'Tequixquiac',
  state: 'Estado de México',
  country: 'MX',
  instagram: 'bubbleKaapeh',
  // Used when Ajustes → "WhatsApp para pedidos" is empty (same as the menu).
  whatsappFallback: '5574182443',
  // Google "Pedir reseñas" link from Google Business Profile (e.g.
  // https://g.page/r/XXXX/review). Empty = open the café on Google Maps.
  googleReviewUrl: '',
  // 24h "HH:MM". Days: 0 = domingo … 6 = sábado. Closed on Tuesday.
  hours: { days: [3, 4, 5, 6, 0, 1], open: '11:30', close: '20:30' },
}

// Address-based links. `biz` = { street, town } (live values or the defaults).
const mapsQuery = (biz = BUSINESS) => `${BUSINESS.name}, ${biz.street}, ${biz.town}, ${BUSINESS.state}`
export const mapsUrlFor = (biz) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery(biz))}`
export const mapsEmbedUrlFor = (biz) => `https://maps.google.com/maps?q=${encodeURIComponent(mapsQuery(biz))}&z=17&output=embed`
export const instagramUrlFor = (handle = BUSINESS.instagram) => `https://www.instagram.com/${String(handle).replace(/^@/, '')}/`
export const reviewUrlFor = (biz) => biz?.reviewUrl?.trim() || mapsUrlFor(biz || BUSINESS)

export const MAPS_URL = mapsUrlFor(BUSINESS)
export const MAPS_EMBED_URL = mapsEmbedUrlFor(BUSINESS)
export const INSTAGRAM_URL = instagramUrlFor(BUSINESS.instagram)
export const REVIEW_URL = BUSINESS.googleReviewUrl || MAPS_URL

// wa.me needs the country code; 10-digit Mexican numbers get 52 in front.
export const whatsappUrl = (rawNumber, text = '') => {
  let n = String(rawNumber || BUSINESS.whatsappFallback).replace(/\D/g, '')
  if (n.length === 10) n = `52${n}`
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const toMinutes = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m }

// "11:30 a. m." style, as people read it in Mexico.
export const formatHour = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  const suffix = h < 12 ? 'a. m.' : 'p. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

const joinNames = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`)

// Week starting Monday, the way the hours are usually read.
const WEEK = [1, 2, 3, 4, 5, 6, 0]

// [3,4,5,6,0,1] → "Miércoles a lunes"; [1,3,5] → "Lunes, miércoles y viernes".
export const daysLabel = (days = []) => {
  const set = new Set(days)
  if (set.size === 7) return 'Todos los días'
  if (set.size === 0) return ''
  // One unbroken run of days (it may wrap past Sunday)?
  const starts = WEEK.filter((d) => set.has(d) && !set.has((d + 6) % 7))
  if (starts.length === 1 && set.size > 2) {
    const start = starts[0]
    let end = start
    while (set.has((end + 1) % 7)) end = (end + 1) % 7
    return `${cap(DAY_NAMES[start])} a ${DAY_NAMES[end]}`
  }
  return cap(joinNames(WEEK.filter((d) => set.has(d)).map((d) => DAY_NAMES[d])))
}

// The days the café doesn't open: "Martes", "Lunes y martes".
export const closedDaysLabel = (days = []) => cap(joinNames(WEEK.filter((d) => !days.includes(d)).map((d) => DAY_NAMES[d])))

export const hoursLabelFor = (hours = BUSINESS.hours) => `${formatHour(hours.open)} a ${formatHour(hours.close)}`

export const HOURS_LABEL = hoursLabelFor(BUSINESS.hours)
export const DAYS_LABEL = daysLabel(BUSINESS.hours.days)
export const CLOSED_LABEL = `${closedDaysLabel(BUSINESS.hours.days)} cerrado`

// Local calendar day as "YYYY-MM-DD" (what <input type="date"> uses).
export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// "Cerrado hoy" from Admin → Landing: closed from today until `until` (inclusive).
export const isClosedOn = (closure, now = new Date()) => Boolean(closure?.until) && dateKey(now) <= closure.until

// "… 11:30 a. m." already ends a sentence; anything else gets its period.
export const withPeriod = (text) => (/[.!?]$/.test(text) ? text : `${text}.`)

// Live status for "Abierto ahora" — { open, closedToday, text }.
export const openStatus = (now = new Date(), hours = BUSINESS.hours, closure = null) => {
  const { days, open, close } = hours
  const mins = now.getHours() * 60 + now.getMinutes()
  const today = now.getDay()
  const closedToday = isClosedOn(closure, now)

  // The next day (after today, and after a "Cerrado hoy" period) we open.
  const nextOpening = (prefix, verb = 'abrimos') => {
    for (let i = 1; i <= 21; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
      if (!days.includes(day.getDay()) || isClosedOn(closure, day)) continue
      const when = i === 1 ? 'mañana' : i < 7 ? `el ${DAY_NAMES[day.getDay()]}` : `el ${DAY_NAMES[day.getDay()]} ${day.getDate()}`
      return { open: false, closedToday, text: `${prefix} · ${verb} ${when} a las ${formatHour(open)}` }
    }
    return { open: false, closedToday, text: prefix }
  }

  if (closedToday) return nextOpening('Hoy no abrimos', 'volvemos')
  if (days.includes(today) && mins >= toMinutes(open) && mins < toMinutes(close)) {
    return { open: true, closedToday, text: `Abierto ahora · hasta las ${formatHour(close)}` }
  }
  if (days.includes(today) && mins < toMinutes(open)) {
    return { open: false, closedToday, text: `Abrimos hoy a las ${formatHour(open)}` }
  }
  return nextOpening('Cerrado')
}
