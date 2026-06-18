// Windows system printing via the browser's built-in print dialog.
// Renders receipt as a hidden iframe and calls contentWindow.print().
// Works on any OS and any printer — routes to the Windows default printer.

// ── HTML builders ─────────────────────────────────────────────────────────────

const SHARED_STYLES = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:4mm}
  .center{text-align:center}.bold{font-weight:bold}
  .large{font-size:16px;font-weight:bold}
  .small{font-size:10px;color:#555}
  .sep{border-top:1px dashed #000;margin:4px 0}
  .row{display:flex;justify-content:space-between}
  .item{margin:4px 0}
  .detail{font-size:10px;color:#444;padding-left:8px}
  .detail.row{display:flex;justify-content:space-between}
  .note{font-style:italic}
  @media print{@page{margin:0;size:80mm auto}body{width:80mm}}
`

export function buildReceiptHtml(content) {
  const ML  = { cash: 'Efectivo', card: 'Tarjeta', loyalty: 'Saldo' }
  const fmt = (n) => (isNaN(n) || n == null ? '0.00' : Number(n).toFixed(2))

  const itemsHtml = content.items.map(item => {
    const optHtml = item.options
      ? Object.entries(item.options).map(([g, v]) =>
          `<div class="detail">${g}: ${Array.isArray(v) ? v.join(', ') : v}</div>`
        ).join('')
      : ''
    const topHtml = item.toppings.map(t =>
      `<div class="detail row"><span>+ ${t.name}</span><span>+$${fmt(t.price)}</span></div>`
    ).join('')
    const noteHtml = item.note ? `<div class="detail note">Nota: ${item.note}</div>` : ''
    return `<div class="item">
      <div class="row bold"><span>${item.name} x${item.quantity}</span><span>$${fmt(item.unitPrice)}</span></div>
      ${optHtml}${topHtml}${noteHtml}
    </div>`
  }).join('')

  const discountHtml = content.discount > 0
    ? `<div class="row"><span>Descuento:</span><span>-$${fmt(content.discount)}</span></div>`
    : ''

  const cashHtml = content.cashReceived
    ? `<div class="row"><span>Recibido:</span><span>$${fmt(content.cashReceived)}</span></div>
       <div class="row"><span>Cambio:</span><span>$${fmt(content.change)}</span></div>`
    : ''

  const customerHtml = content.customerName
    ? `<div class="sep"></div>
       <div>Cliente: ${content.customerName}</div>
       ${content.loyaltyInfo ? `<div class="small">${content.loyaltyInfo}</div>` : ''}`
    : ''

  const noteHtml = content.orderNote
    ? `<div class="sep"></div>
       <div class="small">Nota del pedido:</div>
       <div class="small">${content.orderNote}</div>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>${SHARED_STYLES}.logo{display:block;margin:0 auto 4px;max-width:55mm;max-height:20mm;object-fit:contain}</style></head><body>
  <div class="center"><img class="logo" src="/logo.svg" alt="" /></div>
  <div class="center bold large">${content.businessName}</div>
  <div class="sep"></div>
  <div class="center">#${content.orderId}</div>
  <div class="center small">${content.timestamp.toLocaleDateString('es-MX')} ${content.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
  <div class="sep"></div>
  ${itemsHtml}
  <div class="sep"></div>
  <div class="row"><span>Subtotal (sin IVA):</span><span>$${fmt(content.subtotalSinIva)}</span></div>
  <div class="row"><span>IVA (16%):</span><span>$${fmt(content.iva)}</span></div>
  ${discountHtml}
  <div class="row large"><span>TOTAL:</span><span>$${fmt(content.total)}</span></div>
  <div class="row"><span>Pago:</span><span>${ML[content.paymentMethod] || content.paymentMethod}</span></div>
  ${cashHtml}${customerHtml}${noteHtml}
  <div class="sep"></div>
  <div class="center small">${content.footerMessage}</div>
  </body></html>`
}

export function buildCommandaHtml(content) {
  const itemsHtml = content.items.map(item => {
    const optHtml = item.options
      ? Object.entries(item.options).map(([g, v]) =>
          `<div class="detail">${g}: ${Array.isArray(v) ? v.join(', ') : v}</div>`
        ).join('')
      : ''
    const topHtml = item.toppings.map(t =>
      `<div class="detail">+ ${t.name}</div>`
    ).join('')
    const noteHtml = item.note ? `<div class="detail note">Nota: ${item.note}</div>` : ''
    return `<div class="item">
      <div class="bold">${item.quantity}x ${item.name}</div>
      ${optHtml}${topHtml}${noteHtml}
    </div>`
  }).join('')

  const noteHtml = content.orderNote
    ? `<div class="sep"></div><div class="note" style="font-size:11px">Nota: ${content.orderNote}</div>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>${SHARED_STYLES}</style></head><body>
  <div class="center bold" style="font-size:15px">** COMANDA **</div>
  <div class="sep"></div>
  <div>#${content.orderId}</div>
  <div class="small">${content.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
  <div class="sep"></div>
  ${itemsHtml}
  ${noteHtml}
  <div class="sep"></div>
  </body></html>`
}

// ── Iframe print helper ───────────────────────────────────────────────────────

function printIframe(html) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;border:none;'
    document.body.appendChild(iframe)

    let timeoutId
    const cleanup = () => {
      clearTimeout(timeoutId)
      try { document.body.removeChild(iframe) } catch {}
    }

    timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('Windows print timeout'))
    }, 8000)

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus()
          iframe.contentWindow.print()
          setTimeout(() => { cleanup(); resolve({ success: true }) }, 1000)
        } catch (err) {
          cleanup()
          reject(err)
        }
      }, 300)
    }

    try {
      iframe.contentDocument.open()
      iframe.contentDocument.write(html)
      iframe.contentDocument.close()
    } catch (err) {
      cleanup()
      reject(err)
    }
  })
}

// ── Public print functions ────────────────────────────────────────────────────

export const printViaWindows         = (content) => printIframe(buildReceiptHtml(content))
export const printCommandaViaWindows = (content) => printIframe(buildCommandaHtml(content))
