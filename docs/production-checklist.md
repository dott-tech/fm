# Production checklist

Work that is deliberately deferred until before the first real launch.
Tick items off as they're done.

## Security

- [ ] **Rate limiting.** Better Auth only enables it when `NODE_ENV=production`,
      and its default store is in memory, which doesn't work across Vercel's
      serverless instances. Set `rateLimit.storage: "database"` (adds a
      rate-limit table via migration) and stricter `customRules` for
      `/sign-in/email` and `/sign-up/email`.
- [ ] **HTTPS.** Set `BETTER_AUTH_URL` and `FRONTEND_URL` to the `https://`
      production URLs, so session cookies get the `Secure` flag and
      `trustedOrigins` matches.
- [ ] **Fresh secrets.** Generate a new `BETTER_AUTH_SECRET` for production
      (never reuse the dev one) and set it in Vercel's environment variables.
- [ ] **Email verification.** Needs an email provider (e.g. Resend). Turn on
      `requireEmailVerification`. Alternative: phone number + SMS code.
- [ ] **Forgot password.** Same provider; implement `sendResetPassword`.
- [ ] **Account enumeration on sign-up** (optional). Goes away once
      email verification is required.

## Already in place

- Passwords hashed with scrypt (salted); never returned by the API.
- Sessions in httpOnly, SameSite=Lax cookies; log-out deletes the session.
- `trustedOrigins` CSRF protection.
- Same error for wrong email and wrong password.
- Secrets only in `.env` (git-ignored); `.env.example` documents them.
- Server-side validation of role; Prisma parameterises all queries.
