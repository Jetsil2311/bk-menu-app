// WebUSB direct printing — raw ESC/POS bytes sent to the printer, no OS driver required.
// Requires Chrome or Edge (navigator.usb). On Windows, replace vendor driver with
// WinUSB using Zadig if the printer doesn't appear in the device picker.

// ── USB vendor filter list ────────────────────────────────────────────────────

const USB_VENDOR_IDS = [
  0x04b8,  // Epson
  0x0519,  // Star Micronics
  0x1fc9,  // Xprinter
  0x0dd4,  // Custom / Bixolon
  0x0416,  // Winbond (budget printers)
]

// ── Device lifecycle ──────────────────────────────────────────────────────────

let connectedDevice = null

async function openDevice(device) {
  await device.open()
  if (device.configuration === null) await device.selectConfiguration(1)
  await device.claimInterface(0)
  return device
}

async function sendBytes(device, data) {
  const ep = device.configuration.interfaces[0]
    .alternates[0].endpoints
    .find(e => e.direction === 'out')
  await device.transferOut(ep.endpointNumber, data)
}

export const isWebUsbSupported = () => !!navigator?.usb

// Prompts the browser's USB device picker. Must be called from a user gesture.
export async function connectUsbPrinter() {
  if (!navigator?.usb) return { success: false, error: 'no_support' }
  try {
    const device = await navigator.usb.requestDevice({
      filters: USB_VENDOR_IDS.map(vendorId => ({ vendorId })),
    })
    connectedDevice = await openDevice(device)
    return {
      success: true,
      deviceName: device.productName || device.manufacturerName || 'USB Printer',
    }
  } catch (err) {
    if (err.name === 'NotFoundError') return { success: false, error: 'cancelled' }
    return { success: false, error: err.message }
  }
}

// Auto-reconnects to a previously-paired USB device without a user gesture.
export async function getOrConnectUsbPrinter() {
  if (connectedDevice) {
    try {
      if (!connectedDevice.opened) await connectedDevice.open()
      return connectedDevice
    } catch {
      connectedDevice = null
    }
  }
  if (!navigator?.usb) return null
  try {
    const devices = await navigator.usb.getDevices()
    const known   = devices.find(d => USB_VENDOR_IDS.includes(d.vendorId))
    if (known) {
      connectedDevice = await openDevice(known)
      return connectedDevice
    }
  } catch {}
  return null
}

export const getConnectedDeviceName = () =>
  connectedDevice
    ? (connectedDevice.productName || connectedDevice.manufacturerName || 'USB Printer')
    : null

// ── ESC/POS command set ───────────────────────────────────────────────────────

const ESC = 0x1b
const GS  = 0x1d

const cmd = {
  init:            () => new Uint8Array([ESC, 0x40]),
  alignLeft:       () => new Uint8Array([ESC, 0x61, 0x00]),
  alignCenter:     () => new Uint8Array([ESC, 0x61, 0x01]),
  alignRight:      () => new Uint8Array([ESC, 0x61, 0x02]),
  boldOn:          () => new Uint8Array([ESC, 0x45, 0x01]),
  boldOff:         () => new Uint8Array([ESC, 0x45, 0x00]),
  doubleHeightOn:  () => new Uint8Array([ESC, 0x21, 0x10]),
  doubleHeightOff: () => new Uint8Array([ESC, 0x21, 0x00]),
  smallFontOn:     () => new Uint8Array([ESC, 0x4d, 0x01]),
  smallFontOff:    () => new Uint8Array([ESC, 0x4d, 0x00]),
  feedLines:    (n) => new Uint8Array([ESC, 0x64, n]),
  cutPaper:        () => new Uint8Array([GS,  0x56, 0x41, 0x03]),
  text:        (str) => new TextEncoder().encode(str + '\n'),
}

function mergeBuffers(bufs) {
  const total = bufs.reduce((s, b) => s + b.length, 0)
  const out   = new Uint8Array(total)
  let off = 0
  for (const b of bufs) { out.set(b, off); off += b.length }
  return out
}

function padLine(left, right, width = 32) {
  return left + ' '.repeat(Math.max(1, width - left.length - right.length)) + right
}

function wrapText(str, width = 32) {
  const lines = []
  let current = ''
  for (const word of str.split(' ')) {
    const next = current ? current + ' ' + word : word
    if (next.length <= width) { current = next }
    else { if (current) lines.push(current); current = word }
  }
  if (current) lines.push(current)
  return lines
}

// ── Logo rasterizer ───────────────────────────────────────────────────────────
// Converts /logo.svg to a 1-bit ESC/POS GS v 0 raster image block.
// Result is cached after the first successful load. Returns null on any error
// so the receipt falls back gracefully to the text header only.

const PRINT_W = 384    // printable pixels — 48 chars × 8 dots, safe for 80mm
const LOGO_H  = 120    // target logo height in pixels (square logo → 120×120)
let _logoEscBytes = undefined  // undefined = not yet attempted; null = failed

async function loadLogoEscBytes() {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        // Keep square aspect — logo.svg is 1:1, but handle any ratio
        const aspect = img.naturalHeight / img.naturalWidth || 1
        const logoW  = Math.round(Math.min(LOGO_H / aspect, PRINT_W))
        const logoH  = Math.round(logoW * aspect)
        const padL   = Math.floor((PRINT_W - logoW) / 2)

        const canvas = document.createElement('canvas')
        canvas.width  = PRINT_W
        canvas.height = logoH
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, PRINT_W, logoH)
        ctx.drawImage(img, padL, 0, logoW, logoH)

        const { data } = ctx.getImageData(0, 0, PRINT_W, logoH)
        const bytesPerRow = PRINT_W / 8  // 48 bytes
        const raster = new Uint8Array(bytesPerRow * logoH)
        for (let y = 0; y < logoH; y++) {
          for (let x = 0; x < PRINT_W; x++) {
            const i = (y * PRINT_W + x) * 4
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
            if (lum < 128) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
          }
        }

        const xL = bytesPerRow & 0xFF, xH = (bytesPerRow >> 8) & 0xFF
        const yL = logoH & 0xFF,       yH = (logoH >> 8) & 0xFF
        const header = new Uint8Array([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH])
        const out = new Uint8Array(header.length + raster.length)
        out.set(header); out.set(raster, header.length)
        resolve(out)
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = '/logo.svg'
  })
}

async function getLogoEscBytes() {
  if (_logoEscBytes !== undefined) return _logoEscBytes
  _logoEscBytes = await loadLogoEscBytes()
  return _logoEscBytes
}

// ── ESC/POS receipt builder ───────────────────────────────────────────────────

export function buildEscPosReceipt(content, logoBytes = null) {
  const p    = []
  const SEP  = '================================'
  const ML   = { cash: 'Efectivo', card: 'Tarjeta', loyalty: 'Saldo' }
  const fmt  = (n) => (isNaN(n) || n == null ? '0.00' : Number(n).toFixed(2))

  p.push(cmd.init())
  p.push(cmd.alignCenter())

  if (logoBytes) {
    // Print logo bitmap (GS v 0 block), then feed one line before the text header
    p.push(logoBytes)
    p.push(new Uint8Array([0x0A]))
  }

  p.push(cmd.boldOn(), cmd.doubleHeightOn())
  p.push(cmd.text(content.businessName))
  p.push(cmd.doubleHeightOff(), cmd.boldOff())
  p.push(cmd.text(SEP))
  p.push(cmd.text('#' + content.orderId))
  p.push(cmd.smallFontOn())
  p.push(cmd.text(
    content.timestamp.toLocaleDateString('es-MX') + '  ' +
    content.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  ))
  p.push(cmd.smallFontOff())
  p.push(cmd.text(SEP))
  p.push(cmd.alignLeft())

  for (const item of content.items) {
    p.push(cmd.boldOn())
    p.push(cmd.text(padLine(item.name.slice(0, 20) + ' x' + item.quantity, '$' + fmt(item.unitPrice))))
    p.push(cmd.boldOff(), cmd.smallFontOn())
    if (item.options) {
      for (const [g, v] of Object.entries(item.options)) {
        p.push(cmd.text('  ' + g + ': ' + (Array.isArray(v) ? v.join(', ') : v)))
      }
    }
    for (const t of item.toppings) {
      p.push(cmd.text(padLine('  + ' + t.name, '+$' + fmt(t.price))))
    }
    if (item.note) p.push(cmd.text('  Nota: ' + item.note))
    p.push(cmd.smallFontOff(), cmd.feedLines(1))
  }

  p.push(cmd.text(SEP), cmd.alignRight())
  p.push(cmd.text(padLine('Subtotal (sin IVA):', '$' + fmt(content.subtotalSinIva))))
  p.push(cmd.text(padLine('IVA (16%):', '$' + fmt(content.iva))))
  if (content.discount > 0) {
    p.push(cmd.text(padLine('Descuento:', '-$' + fmt(content.discount))))
  }
  p.push(cmd.boldOn(), cmd.doubleHeightOn())
  p.push(cmd.text(padLine('TOTAL:', '$' + fmt(content.total))))
  p.push(cmd.doubleHeightOff(), cmd.boldOff(), cmd.alignLeft())
  p.push(cmd.text(padLine('Pago:', ML[content.paymentMethod] || content.paymentMethod)))
  if (content.cashReceived) {
    p.push(cmd.text(padLine('Recibido:', '$' + fmt(content.cashReceived))))
    p.push(cmd.text(padLine('Cambio:',   '$' + fmt(content.change))))
  }
  if (content.customerName) {
    p.push(cmd.text(SEP))
    p.push(cmd.text('Cliente: ' + content.customerName))
    if (content.loyaltyInfo) {
      p.push(cmd.smallFontOn(), cmd.text(content.loyaltyInfo), cmd.smallFontOff())
    }
  }
  if (content.orderNote) {
    p.push(cmd.text(SEP), cmd.text('Nota del pedido:'))
    for (const line of wrapText(content.orderNote)) p.push(cmd.text(line))
  }
  p.push(cmd.text(SEP), cmd.alignCenter())
  p.push(cmd.text(content.footerMessage))
  p.push(cmd.feedLines(4), cmd.cutPaper())

  return mergeBuffers(p)
}

// ── Main USB print function ───────────────────────────────────────────────────

export async function printViaUsb(content) {
  const device = await getOrConnectUsbPrinter()
  if (!device) throw new Error('No USB printer connected')
  // Pre-load logo bytes — fails silently and falls back to text-only header
  const logoBytes = await getLogoEscBytes().catch(() => null)
  const data    = buildEscPosReceipt(content, logoBytes)
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('USB print timeout')), 8000)
  )
  await Promise.race([sendBytes(device, data), timeout])
}
