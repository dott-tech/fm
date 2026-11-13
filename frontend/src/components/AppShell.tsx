import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useI18n } from '../i18n'
import { authClient } from '../lib/auth-client'
import { prefetchTabs } from '../lib/queries'

// Frame for the main tabs: page content + a bottom navigation bar under the
// thumb. Entry screens (add income, add expense...) don't use it: they have
// their own pinned Save button instead.

const TABS = [
  { to: '/', key: 'home', icon: <HomeIcon /> },
  { to: '/week', key: 'week', icon: <ChartIcon /> },
  { to: '/pots', key: 'plans', icon: <PotIcon /> },
  { to: '/settings', key: 'settings', icon: <GearIcon /> },
] as const

// Once the first screen is up, quietly download the other tabs' code and
// data, so the first tap on each tab is instant.
function useWarmUpTabs() {
  useEffect(() => {
    const warm = () => {
      prefetchTabs()
      void import('../pages/WeekPage')
      void import('../pages/PotsPage')
      void import('../pages/SettingsPage')
      void import('../pages/AddIncomePage')
      void import('../pages/AddExpensePage')
    }
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 600))
    const handle = idle(warm)
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(handle)
  }, [])
}

export function AppShell() {
  const { m } = useI18n()
  const { pathname } = useLocation()
  const { data: session } = authClient.useSession()
  useWarmUpTabs()
  const activeIndex = Math.max(
    0,
    TABS.findIndex((tab) => (tab.to === '/' ? pathname === '/' : pathname.startsWith(tab.to))),
  )

  return (
    <>
      <div className="pb-24">
        {session?.user.isAnonymous && (
          // Guests: a slim reminder that their data isn't tied to an account yet.
          <div className="bg-info-soft text-info-ink">
            <p className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 text-sm">
              <span>{m.guest.banner}</span>
              <Link to="/signup" viewTransition className="font-semibold underline underline-offset-2">
                {m.guest.keepData}
              </Link>
            </p>
          </div>
        )}
        <Outlet />
      </div>
      <nav
        aria-label={m.nav.main}
        className="tabbar fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <div className="relative mx-auto max-w-md">
          {/* Sliding pill behind the active tab. Logical inset (start) so it
              also slides the right way in Arabic. */}
          <span
            aria-hidden
            className="absolute top-2 h-12 w-1/4 transition-[inset-inline-start] duration-300 ease-out"
            style={{ insetInlineStart: `${activeIndex * 25}%` }}
          >
            <span className="mx-auto block h-full w-16 rounded-2xl bg-good-soft" />
          </span>
          <ul className="relative grid grid-cols-4">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.to === '/'}
                  viewTransition
                  className={({ isActive }) =>
                    `press flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                      isActive ? 'text-accent-ink' : 'text-muted'
                    }`
                  }
                >
                  {tab.icon}
                  {m.nav[tab.key]}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  )
}

// Title row used by every tab page, with an optional action on the end side.
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="rise mb-5 flex items-end justify-between gap-3">
      <div>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {action}
    </header>
  )
}

// ---- Icons (inline SVG, inherit the text colour) ----

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function HomeIcon() {
  return (
    <Icon>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </Icon>
  )
}

function ChartIcon() {
  return (
    <Icon>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Icon>
  )
}

function PotIcon() {
  return (
    <Icon>
      <rect x="3" y="7" width="18" height="13" rx="3" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2M12 12v4" />
    </Icon>
  )
}

function GearIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icon>
  )
}
