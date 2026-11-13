import { useSyncExternalStore } from 'react'

// "Install the app" support for the Settings screen.
//
// Android / desktop Chrome & Edge fire `beforeinstallprompt` once, early, when
// the app is installable. We keep that event so a button can show the
// browser's install dialog later. iPhone Safari has no such event: there the
// user installs through Share -> "Add to Home Screen", so we show those steps.
// This module is imported from main.tsx so the listener exists before the
// event fires.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = 'installed' | 'available' | 'ios' | 'unsupported'

let deferred: InstallPromptEvent | null = null
let installed = isStandalone()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

// Ask the browser to keep this app's stored files even when the device runs
// low on space (otherwise cached app files can be evicted). Installed apps are
// usually granted this automatically; it's a harmless no-op if refused.
function requestPersistentStorage() {
  void navigator.storage?.persist?.().catch(() => {})
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // we show our own button instead of the mini-infobar
  deferred = e as InstallPromptEvent
  notify()
})

window.addEventListener('appinstalled', () => {
  installed = true
  deferred = null
  requestPersistentStorage()
  notify()
})

if (installed) requestPersistentStorage()

function getState(): InstallState {
  if (installed) return 'installed'
  if (deferred) return 'available'
  if (isIos()) return 'ios'
  return 'unsupported'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstallState() {
  return useSyncExternalStore(subscribe, getState)
}

// Shows the browser's install dialog. Resolves true if the user accepted.
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const event = deferred
  await event.prompt()
  const { outcome } = await event.userChoice
  deferred = null // the event can only be used once
  if (outcome === 'accepted') installed = true
  notify()
  return outcome === 'accepted'
}
