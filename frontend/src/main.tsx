import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { GuestOnly, RequireAuth } from './components/RequireAuth'
import './index.css'
import { AddExpensePage } from './pages/AddExpensePage'
import { AddIncomePage } from './pages/AddIncomePage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { PotFormPage } from './pages/PotFormPage'
import { PotsPage } from './pages/PotsPage'
import { SettingsPage } from './pages/SettingsPage'
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
          {/* Main tabs, with the bottom navigation bar */}
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/week" element={<WeekPage />} />
            <Route path="/pots" element={<PotsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          {/* Entry screens: full screen with their own Save button */}
          <Route path="/income/new" element={<AddIncomePage />} />
          <Route path="/expenses/new" element={<AddExpensePage />} />
          <Route path="/pots/new" element={<PotFormPage />} />
          <Route path="/pots/:id/edit" element={<PotFormPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
