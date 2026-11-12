import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { GuestOnly, RequireAuth } from './components/RequireAuth'
import './index.css'
import { AddExpensePage } from './pages/AddExpensePage'
import { AddIncomePage } from './pages/AddIncomePage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { NewPotPage } from './pages/NewPotPage'
import { PotsPage } from './pages/PotsPage'
import { SignupPage } from './pages/SignupPage'
import { WeekPage } from './pages/WeekPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/income/new" element={<AddIncomePage />} />
          <Route path="/expenses/new" element={<AddExpensePage />} />
          <Route path="/week" element={<WeekPage />} />
          <Route path="/pots" element={<PotsPage />} />
          <Route path="/pots/new" element={<NewPotPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
