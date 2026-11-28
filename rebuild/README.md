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


## Review handoff and Repro Capsule

The temporary share viewer can export a versioned review packet in JSON or Markdown. It includes the share/video URLs, expiry and password state, review brief/status, guest decisions, timestamped discussion, frame points, owner annotations, captions, chapters and bug-report context. Deleted comment bodies are redacted. Guest labels are unverified and the export is a handoff artifact, not an authenticated identity record.

The optional Chrome/Edge Manifest V3 extension is in [extension/](extension/README.md). It starts only after a user click, captures a short click/navigation-key outline in the active tab, has no host permissions or network code, and asks the user to review/edit the JSON before download. Import it from the editor's **Captions & context → Bug report → Import Repro Capsule** action. ScreenNote sanitizes URL credentials, query and fragment again on import. Imported context remains local until the creator explicitly saves/publishes it; publishing makes saved context visible to share-link viewers.

The extension does not collect screenshots, form values, typed characters, cookies, network requests or console logs. It is an interaction outline, not automatic full telemetry or a guaranteed reproduction.

## Android PWA/native handoff

The native Android shell bundles the rebuilt PWA assets from the Cloudflare Vite output. Native screen recordings remain in app-private storage and are exposed to the trusted WebView only through the origin-scoped `/__native_recordings/{id}` route. The PWA imports the selected recording into its local library and opens the preview; publishing remains an explicit user action.

The PWA keeps the local library usable offline, while publishing and guest sharing require connectivity. Android internal builds use the isolated Cloudflare development origin for backend calls; the production origin is unchanged until a separate release decision.
