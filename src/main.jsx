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
import { Stock } from './views/admin/Stock'
import { Finance } from './views/admin/Finance'
import { StationsManager } from './views/admin/StationsManager'
import { RouteGate } from './components/admin/RouteGate'
import { RegisterProvider } from './context/RegisterContext'
import { StationProvider } from './context/StationContext'
import { TestModeBadge } from './components/TestModeBadge'

// Per-screen access is now gated by station (see StationContext /
// RouteGate) instead of a single shared PIN. Each station's disabled
// routes are configured in /admin/estaciones.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TestModeBadge />
    <BrowserRouter>
      <RegisterProvider>
        <StationProvider>
          <Routes>
            <Route path='/*' element={<Home />} />
            <Route path='/admin' element={<AdminLayout />}>
              <Route index element={<RouteGate routeKey="overview"><Overview /></RouteGate>} />
              <Route path="pedidos" element={<RouteGate routeKey="pedidos"><Orders /></RouteGate>} />
              <Route path="metricas" element={<RouteGate routeKey="metricas"><Metrics /></RouteGate>} />
              <Route path="promociones" element={<RouteGate routeKey="promociones"><Promos /></RouteGate>} />
              <Route path="menu" element={<RouteGate routeKey="menu"><MenuEditor /></RouteGate>} />
              <Route path="pos" element={<RouteGate routeKey="pos"><POS /></RouteGate>} />
              <Route path="clientes" element={<RouteGate routeKey="clientes"><Customers /></RouteGate>} />
              <Route path="stock" element={<RouteGate routeKey="stock"><Stock /></RouteGate>} />
              <Route path="finanzas" element={<RouteGate routeKey="finanzas"><Finance /></RouteGate>} />
              <Route path="caja" element={<RouteGate routeKey="caja"><Register /></RouteGate>} />
              <Route path="legacy" element={<RouteGate routeKey="legacy"><Admin /></RouteGate>} />
              <Route path="estaciones" element={<RouteGate routeKey="estaciones"><StationsManager /></RouteGate>} />
            </Route>
          </Routes>
        </StationProvider>
      </RegisterProvider>
    </BrowserRouter>
  </StrictMode>,
)
