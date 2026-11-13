import { useSyncExternalStore } from 'react'

// Light / dark mode. "system" follows the phone's setting and updates live.
// The choice is a per-device preference, saved in localStorage.
// index.html applies it before the first paint, so there's no white flash.

export type ThemePref = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'theme'
const listeners = new Set<() => void>()
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function readSaved(): ThemePref {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

let pref: ThemePref = readSaved()

function apply() {
  const dark = pref === 'dark' || (pref === 'system' && darkQuery.matches)
  document.documentElement.classList.toggle('dark', dark)
  // Browser UI (status bar on Android) follows the theme too.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c0a09' : '#047857')
}
apply()

// Follow the system setting while on "system".
darkQuery.addEventListener('change', () => {
  if (pref === 'system') apply()
})

export function setThemePref(next: ThemePref) {
  pref = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // ignore: preference just won't persist
  }
  apply()
  listeners.forEach((notify) => notify())
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => pref,
  )
}
