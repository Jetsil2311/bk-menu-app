import {
  Coffee,
  Croissant,
  CupSoda,
  Gift,
  Milk,
  Sandwich,
  Star,
  UtensilsCrossed,
} from 'lucide-react'

// Each menu section gets a "boba flavor" tone (cycled by index) so the
// customer can tell sections apart at a glance. Classes are written out in
// full so Tailwind can detect them.
export const SECTION_TONES = [
  { bg: 'bg-mango', ink: 'text-mango-ink', ring: 'ring-mango-ink/20' },
  { bg: 'bg-taro', ink: 'text-taro-ink', ring: 'ring-taro-ink/20' },
  { bg: 'bg-matcha', ink: 'text-matcha-ink', ring: 'ring-matcha-ink/20' },
  { bg: 'bg-fresa', ink: 'text-fresa-ink', ring: 'ring-fresa-ink/20' },
  { bg: 'bg-latte', ink: 'text-latte-ink', ring: 'ring-latte-ink/20' },
]

export const getSectionTone = (index = 0) =>
  SECTION_TONES[((index % SECTION_TONES.length) + SECTION_TONES.length) % SECTION_TONES.length]

// Picks an icon from the section name. Owners name sections freely in the
// admin, so this matches on keywords and falls back to a generic icon.
const ICON_RULES = [
  [/favorit|popular|top|recomend/i, Star],
  [/combo|promo|paquete/i, Gift],
  [/chapata|sandw|torta|baguette/i, Sandwich],
  [/pan|croiss|reposter|postre|acompa/i, Croissant],
  [/cream|cozy|calient|leche|chocolate/i, Milk],
  [/coffee|caf[eé]|espresso|latte/i, Coffee],
  [/helad|fr[ií]a|frappe|iced|boba|t[eé]|bebida/i, CupSoda],
]

export const getSectionIcon = (name = '') =>
  ICON_RULES.find(([re]) => re.test(name))?.[1] ?? UtensilsCrossed
