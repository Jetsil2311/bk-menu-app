// Product photo helpers shared by the landing page and the menu editor.

const CLOUD_MARKER = 'res.cloudinary.com/dcnjg8igs/image/upload/'

// Photo URL at the size we need. Cloudinary photos get cropped and converted
// (that also makes .heic photos viewable); legacy photos come from
// /public/products like on the menu.
export const productImage = (p, transform) => {
  const url = p?.imageUrl
  if (url && url.includes(CLOUD_MARKER)) return transform ? url.replace(CLOUD_MARKER, `${CLOUD_MARKER}${transform}/`) : url
  if (url) return url
  if (p?.image) return `${import.meta.env.BASE_URL}products/${p.id ?? p.docId}${p.image}`
  return null
}

export const hasImage = (p) => Boolean(p?.imageUrl || p?.image)

// Promo posters (text + prices baked in) are uploaded as PNG; real photos are JPG/HEIC.
export const isPoster = (p) => /\.png($|\?)/i.test(p?.imageUrl || '')

// false = "Agotado" on the menu
export const isOnSale = (p) => p?.isActive !== false
