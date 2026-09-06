import { useNavigate } from 'react-router'
import { MessageCircle } from 'lucide-react'
import { useWhatsAppOrders } from '../../context/WhatsAppOrdersContext'

// Amber bar surfacing pending WhatsApp orders — reuses the same amber
// classes already used elsewhere in this codebase (e.g. the "Enviar a
// Pedidos" affordance on a POS ticket), not new colors.
export const WhatsAppBanner = () => {
  const { pending, pendingCount } = useWhatsAppOrders()
  const navigate = useNavigate()

  if (pendingCount === 0) return null

  const oldest = pending[0]

  const handleClick = () => {
    navigate('/admin/pos', { state: { loadWhatsApp: oldest.id } })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/15 transition-colors cursor-pointer shrink-0"
    >
      <MessageCircle size={16} />
      {pendingCount === 1
        ? 'Nueva orden de WhatsApp'
        : `${pendingCount} órdenes de WhatsApp pendientes`}
      {' — Ver más →'}
    </button>
  )
}
