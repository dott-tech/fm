import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AppShell } from './components/AppShell'
import { GuestOnly, RequireAuth } from './components/RequireAuth'
import './index.css'
import './lib/theme' // applies the saved theme and follows the system setting
import { queryClient } from './lib/queries'

// Each screen is loaded on demand (code splitting): the first download only
// contains what the first screen needs; other screens arrive when opened.
const page = (load: () => Promise<{ Component: ComponentType }>) => ({ lazy: load })

const router = createBrowserRouter([
  {
    Component: GuestOnly,
    children: [
      { path: '/login', ...page(() => import('./pages/LoginPage').then((m) => ({ Component: m.LoginPage }))) },
      { path: '/signup', ...page(() => import('./pages/SignupPage').then((m) => ({ Component: m.SignupPage }))) },
    ],
  },
  {
    Component: RequireAuth,
    children: [
      {
        // Main tabs, with the bottom navigation bar
        Component: AppShell,
        children: [
          { path: '/', ...page(() => import('./pages/DashboardPage').then((m) => ({ Component: m.DashboardPage }))) },
          { path: '/week', ...page(() => import('./pages/WeekPage').then((m) => ({ Component: m.WeekPage }))) },
          { path: '/pots', ...page(() => import('./pages/PotsPage').then((m) => ({ Component: m.PotsPage }))) },
          { path: '/settings', ...page(() => import('./pages/SettingsPage').then((m) => ({ Component: m.SettingsPage }))) },
        ],
      },
      // Entry screens: full screen with their own Save button
      { path: '/income/new', ...page(() => import('./pages/AddIncomePage').then((m) => ({ Component: m.AddIncomePage }))) },
      { path: '/expenses/new', ...page(() => import('./pages/AddExpensePage').then((m) => ({ Component: m.AddExpensePage }))) },
      { path: '/pots/new', ...page(() => import('./pages/PotFormPage').then((m) => ({ Component: m.PotFormPage }))) },
      { path: '/pots/:id/edit', ...page(() => import('./pages/PotFormPage').then((m) => ({ Component: m.PotFormPage }))) },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
