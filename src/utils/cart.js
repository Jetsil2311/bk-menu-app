// Cart helpers kept in one place to keep Home.jsx lean.

export const formatMoney = (value) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(value)

export const getCartKey = (id, option) => `${id}::${option ?? ''}`

// Creates a short "fly to cart" animation from the product card to the cart button.
export const flyToCart = ({ fromRect, imgSrc, target }) => {
  if (!target || !fromRect) return

  const toRect = target.getBoundingClientRect()
  const el = imgSrc ? document.createElement('img') : document.createElement('div')

  if (imgSrc) {
    el.src = imgSrc
    el.alt = ''
    el.style.width = '46px'
    el.style.height = '46px'
    el.style.objectFit = 'cover'
    el.style.borderRadius = '14px'
    el.style.border = '1px solid rgba(255,255,255,0.35)'
    el.style.background = 'rgba(255,255,255,0.08)'
  } else {
    el.style.width = '18px'
    el.style.height = '18px'
    el.style.borderRadius = '9999px'
    el.style.background = 'rgba(255,255,255,0.95)'
  }

  el.style.position = 'fixed'
  el.style.left = `${fromRect.left + fromRect.width / 2}px`
  el.style.top = `${fromRect.top + fromRect.height / 2}px`
  el.style.boxShadow = '0 14px 34px rgba(0,0,0,0.30)'
  el.style.zIndex = '2147483647'
  el.style.transform = 'translate(-50%, -50%) scale(1)'
  el.style.transition = 'transform 900ms cubic-bezier(.2,.9,.2,1)'
  el.style.pointerEvents = 'none'

  document.body.appendChild(el)

  const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2)
  const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2)

  requestAnimationFrame(() => {
    el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.28)`
  })

  const cleanup = () => {
    el.removeEventListener('transitionend', cleanup)
    el.remove()

    target.classList.add('animate-[cartbump_450ms_ease-out]')
    setTimeout(
      () => target.classList.remove('animate-[cartbump_450ms_ease-out]'),
      500
    )
  }

  el.addEventListener('transitionend', cleanup)
}
