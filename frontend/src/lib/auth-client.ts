import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// Talks to the backend's /api/auth/* endpoints. Same origin as the page
// (Vite proxies /api in dev), so the session cookie just works.
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [
    // Tell the client about our extra user columns so they're typed.
    inferAdditionalFields({
      user: {
        role: { type: ['cab_driver', 'delivery_rider'], required: true },
        currency: { type: 'string', required: false },
        weeklyTarget: { type: 'number', required: false },
      },
    }),
  ],
})

export type Role = 'cab_driver' | 'delivery_rider'
