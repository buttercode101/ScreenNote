# ScreenNote Cloudflare rebuild

This branch is being executed as a **full replacement**, not a reduced rewrite.

## Current implementation state

- The complete ScreenNote 0.5.0 browser app from `main` is restored under `legacy/public` and `legacy/lib`, including its original capture, local IndexedDB library, import/trim/annotation tools, captions and transcript search, chapters, bug-report context, threaded discussions, reactions, review status, recovery keys, offline safeguards, upload retry/resume and all original user journeys.
- The Cloudflare Worker serves the rebuilt original browser bundle and retains the isolated D1/R2 candidate API.
- **Temporary parity bridge:** `/api/clip` currently proxies to the verified Vercel production API so the restored original UI does not lose the mature API contract during the native backend migration. Therefore this deployment is not yet independent of Vercel. Do not call it a completed Cloudflare-native replacement.
- The bridge must be replaced by the Cloudflare D1/R2 implementation only after black-box API parity tests pass for every operation. Existing production data is not copied or mutated by migration tests.
- Vercel production remains unchanged and is the rollback reference.

## Build and test

```sh
npm install
npm run typecheck
npm test
npm run build
npm run e2e
```

The build first bundles the original browser app from `legacy/public/app.js` into `legacy/dist`, then packages it as Cloudflare Worker static assets. `/api/clip` is Worker-first.

## Release gates

See `FEATURE-PARITY-ACCEPTANCE.md`. Current verdict: **full browser feature set restored; Cloudflare-native backend parity and production cutover are still in progress**. Never infer complete acceptance from candidate-only tests.
