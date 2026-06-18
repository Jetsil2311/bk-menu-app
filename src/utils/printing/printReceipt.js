// Central print router — selects USB or Windows path based on settings.printMethod.
// Never throws. All errors return { success: false, reason }.

import { buildReceiptContent, buildCommandaContent } from './receiptContent'
import { printViaUsb, getOrConnectUsbPrinter }       from './usbPrinter'
import { printViaWindows, printCommandaViaWindows }  from './windowsPrinter'

export async function printReceipt(order, settings) {
  if (!settings?.printingEnabled) return { success: false, reason: 'disabled' }

  const content = buildReceiptContent(order, settings)
  const method  = settings?.printMethod || 'windows'

  try {
    if (method === 'usb') {
      await printViaUsb(content)
    } else {
      await printViaWindows(content)
    }
    return { success: true }
  } catch (err) {
    console.error('[print]', err)
    return { success: false, reason: err.message }
  }
}

// Comanda always uses the Windows path — kitchen printer may differ from receipt printer.
export async function printComanda(order) {
  try {
    await printCommandaViaWindows(buildCommandaContent(order))
    return { success: true }
  } catch (err) {
    console.error('[print] Comanda error:', err)
    return { success: false, reason: err.message }
  }
}

export { buildReceiptContent, buildCommandaContent, getOrConnectUsbPrinter }
