import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Home } from './views/Home'
import { Admin } from './views/Admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes >
        <Route path='/*' element={<Home />} />
        <Route path='/admin' element={<Admin />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
