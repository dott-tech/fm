# Deploying to Cloudflare

One Cloudflare Worker serves everything: the API at `/api/*` and the built
frontend (static files) for every other path, on one domain. Config:
`backend/wrangler.jsonc`, entry point: `backend/src/worker.ts`.

## First time

Run these from the `backend` folder.

1. Log in to Cloudflare (opens the browser):

   ```bash
   npx wrangler login
   ```

2. Deploy once. This builds the frontend and uploads everything, then prints
   the app's URL, e.g. `https://fm.<your-subdomain>.workers.dev`.
   The API doesn't work until step 3 is done.

   ```bash
   npm run deploy
   ```

3. Set the secrets. Each command asks for the value; paste it and press Enter.

   ```bash
   npx wrangler secret put DATABASE_URL        # pooled Neon URL (host has -pooler)
   npx wrangler secret put BETTER_AUTH_SECRET  # NEW random value, not the dev one
   npx wrangler secret put BETTER_AUTH_URL     # the https://...workers.dev URL from step 2
   npx wrangler secret put FRONTEND_URL        # the same URL
   ```

   Generate the auth secret with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

   Secrets apply right away; no redeploy needed.

## Git auto-deploy (Cloudflare dashboard)

Workers -> fm -> Settings -> Build, with the root directory left empty
(the repo root):

- Build command: `npm run build`
- Deploy command: `npm run deploy`

Every push to `main` then builds and deploys. The root `package.json`
holds these two scripts; the app itself is in `frontend/` and `backend/`.

## Every later release

```bash
npm run deploy
```

If the release changes `prisma/schema.prisma`, apply the migration to the
production database first: `npx prisma migrate deploy` with `DIRECT_URL`
pointing at that database.

## Test the Worker locally

`npm run cf:dev` runs the real Workers runtime on http://localhost:8787.
It reads secrets from `backend/.dev.vars` (git-ignored, same format as
`.env`; set `BETTER_AUTH_URL` and `FRONTEND_URL` to `http://localhost:8787`).

## Notes

- Prisma generates two clients (Node for local dev, `workerd` for
  Cloudflare); `src/db.ts` imports `#prisma` and `package.json` "imports"
  picks the right one. Run `npx prisma generate` after every migration:
  Prisma 7's `migrate dev` no longer does it.
- On Workers each request gets its own database client: Cloudflare doesn't
  let one request use a connection opened by another.
- Custom domain: Cloudflare dashboard -> Workers -> fm ->
  Settings -> Domains. Then update `BETTER_AUTH_URL` and `FRONTEND_URL`.
