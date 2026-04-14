import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router'
import { Home } from './views/Home'
import { AdminLayout } from './views/admin/AdminLayout'
import { Overview } from './views/admin/Overview'
import { Orders } from './views/admin/Orders'
import { Metrics } from './views/admin/Metrics'
import { Promos } from './views/admin/Promos'
import { Admin } from './views/Admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes >
        <Route path='/*' element={<Home />} />
        <Route path='/admin' element={<AdminLayout />}>
          <Route index element={<Overview />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="metricas" element={<Metrics />} />
          <Route path="promociones" element={<Promos />} />
          <Route path="legacy" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
