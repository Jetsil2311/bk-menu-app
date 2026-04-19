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
import { PinGate } from './components/admin/PinGate'
import { RegisterProvider } from './context/RegisterContext'

// Free screens (no PIN): Pedidos, POS, Clientes, Caja
// Protected screens (PIN every visit): Overview, Métricas, Promociones, Menú, Legacy

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <RegisterProvider>
        <Routes>
          <Route path='/*' element={<Home />} />
          <Route path='/admin' element={<AdminLayout />}>
            <Route index element={<PinGate><Overview /></PinGate>} />
            <Route path="pedidos" element={<Orders />} />
            <Route path="metricas" element={<PinGate><Metrics /></PinGate>} />
            <Route path="promociones" element={<PinGate><Promos /></PinGate>} />
            <Route path="menu" element={<PinGate><MenuEditor /></PinGate>} />
            <Route path="pos" element={<POS />} />
            <Route path="clientes" element={<Customers />} />
            <Route path="caja" element={<Register />} />
            <Route path="legacy" element={<PinGate><Admin /></PinGate>} />
          </Route>
        </Routes>
      </RegisterProvider>
    </BrowserRouter>
  </StrictMode>,
)
