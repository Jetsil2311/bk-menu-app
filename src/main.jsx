import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Home } from './views/Home'
import { AdminLayout } from './views/admin/AdminLayout'
import { Overview } from './views/admin/Overview'
import { Orders } from './views/admin/Orders'
import { Metrics } from './views/admin/Metrics'
import { Promos } from './views/admin/Promos'
import { MenuEditor } from './views/admin/MenuEditor'
import { Admin } from './views/Admin'
import { POS } from './views/admin/POS'
import { Customers } from './views/admin/Customers'
import { Register } from './views/admin/Register'
import { SmartPinGate } from './components/admin/PinGate'
import { RegisterProvider } from './context/RegisterContext'

// PIN protection per screen is now configurable via the lock icon in the Topbar.
// Config is stored in Firestore settings/general.pinGateConfig and synced in real-time.
// Defaults: Overview, Métricas, Promociones, Menú, Legacy = locked; others = unlocked.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <RegisterProvider>
        <Routes>
          <Route path='/*' element={<Home />} />
          <Route path='/admin' element={<AdminLayout />}>
            <Route index element={<SmartPinGate routeKey="overview"><Overview /></SmartPinGate>} />
            <Route path="pedidos" element={<SmartPinGate routeKey="pedidos"><Orders /></SmartPinGate>} />
            <Route path="metricas" element={<SmartPinGate routeKey="metricas"><Metrics /></SmartPinGate>} />
            <Route path="promociones" element={<SmartPinGate routeKey="promociones"><Promos /></SmartPinGate>} />
            <Route path="menu" element={<SmartPinGate routeKey="menu"><MenuEditor /></SmartPinGate>} />
            <Route path="pos" element={<SmartPinGate routeKey="pos"><POS /></SmartPinGate>} />
            <Route path="clientes" element={<SmartPinGate routeKey="clientes"><Customers /></SmartPinGate>} />
            <Route path="caja" element={<SmartPinGate routeKey="caja"><Register /></SmartPinGate>} />
            <Route path="legacy" element={<SmartPinGate routeKey="legacy"><Admin /></SmartPinGate>} />
          </Route>
        </Routes>
      </RegisterProvider>
    </BrowserRouter>
  </StrictMode>,
)
