# ScreenNote — Cloudflare application

This branch is a separately implemented Cloudflare-first product. It is not a visual clone or a repackaged copy of the Vercel frontend.

## Application boundary

- **Frontend:** React 19 + TypeScript + Vite. The deployed entrypoint is `rebuild/index.html` and `rebuild/src/main.tsx`.
- **Design system:** independent editorial interface: Space Grotesk / Source Sans 3 / DM Mono, warm mineral paper, near-black recording surface and acid-lime action colour. It does not load the Vercel stylesheet or Vercel HTML/JS.
- **Build assets:** `scripts/prepare-public.mjs` now copies only the offline service worker and app icon. It does not bundle or copy the legacy browser app.
- **Backend:** Cloudflare Worker with D1 metadata and R2 media storage.
- **Local-first data:** IndexedDB stores original recordings on the user's device; publishing is explicit.
- **Legacy source:** `legacy/` remains in this branch as a behavior/feature reference and migration source only. It is not the deployed UI.

## Important backend limitation

The Worker still has a temporary `/api/clip` compatibility proxy to the Vercel API for older 0.5.0 clients and data contracts. The new frontend is independent of the Vercel frontend, but the entire service is not yet independent of Vercel. Do not describe the API layer as fully Cloudflare-native until the proxy is removed after contract-parity tests and an explicit legacy-link migration plan.

Vercel production remains unchanged.

## Build and test

```sh
npm install
npm run typecheck
npm test
npm run build
npm run e2e
```

The build emits the Vite/React app. Legacy HTML, CSS and browser JavaScript are deliberately excluded from the Worker asset bundle.

## Release gates

See `FEATURE-PARITY-ACCEPTANCE.md`. The independent frontend is a new implementation; feature parity, Worker/API independence, visual acceptance, security review, accessibility review, and physical-device checks remain separate release gates.
