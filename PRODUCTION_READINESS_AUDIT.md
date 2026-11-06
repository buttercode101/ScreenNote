# Production Readiness Audit — ScreenNote

Inspection date: 2026-11-06 · Owner: Buttercode Systems (buttercode101)
Repository: https://github.com/buttercode101/ScreenNote · Branch: `main`
Starting commit: `421eb4d4cb335d7cabd82e4854450dc4b394a057` (2026-11-05)
Tested commit: `421eb4d` + uncommitted fix set (see DEFECT_REGISTER.md S-001–S-005)
Environment: Termux/Android 14, Node v26.3.1 (repo/CI: 24.x)
Canonical domain: https://screennote-woad.vercel.app (verified live; historical URL is current — no migration)

## Architecture map
- Vanilla HTML/CSS/JS bundled by esbuild (`scripts/build.mjs` → `dist/`); no framework.
- Vercel Node Functions: `api/clip.js` (60s maxDuration).
- Storage: private Supabase Storage + Postgres via Edge Function gateway (`supabase/functions/screennote-store/`); legacy `@vercel/blob` adapter retained (`lib/vercel-store.js`).
- Browser: IndexedDB local library; mediabunny + fix-webm-duration for local trim.
- Native Android app under `android/` (Gradle 8.13, emulator API 35 in CI).

## Feature inventory (verified codes)
| Feature | Status | Evidence |
|---|---|---|
| Local recording library | WORKING | library tests pass |
| MP4/WebM import + local trim | WORKING | import-media/trim tests pass |
| Publishing + expiring links | WORKING | share-options + live-sharing CI smoke (65s WebM) |
| Password protection | WORKING | access tests; revoked/pending cannot republish without password (test) |
| Timestamped comments + reply-to-any | WORKING | discussion/comment-actions tests pass |
| Guest access | WORKING | guest tests; gateway auth gates tested |
| Supabase fail-closed | WORKING | "fails closed, never falls back" test passes |
| Physical-device recording | BLOCKED | emulator only in CI; handset/native capture gates open (LAUNCH-READINESS Phase 2) |
| Spend alerts for 1 GB budget | NOT IMPLEMENTED | no alert configured — egress unbudgeted (doc'd risk) |

## Dependency inventory
Prod deps: `@vercel/blob 2.8.2`, `esbuild 0.28.2`, `mediabunny 1.62.1`, `fix-webm-duration 1.0.6`, `c8 ^12` (dev).
`npm audit --omit=dev --audit-level=high`: 0 high — 4 moderate, dev-only via `c8→test-exclude→glob/minimatch` (fix requires breaking c8 downgrade; accepted, documented).

## Test inventory
19 test files in `tests/*.test.js`; `npm test` = **112 tests, 112 pass, 0 fail** (2026-11-06, after fix).
`npm run build` OK; QA-fixture leak guard (`test ! -e dist/fixture.js`) passes.
UI fixtures (`tests/ui/`) are manual-browser only — previously the test glob `tests/ui/*.test.js` matched zero files (S-002 fixed).

## Deployment map
GitHub `main` → `verify.yml` (npm ci → test → audit → build) + `android.yml` + `live-sharing.yml` (65s synthetic upload→playback→revoke/delete against production) → Vercel → `screennote-woad.vercel.app`.
Live 2026-11-06: HTTP 200; `/api/clip?op=health` → `{"configured":true,"maxBytes":50000000,"maxSeconds":600,"maxStorageBytes":1000000000,"reservedBytes":112741756,"availableBytes":887258244,"reservedRecordings":10}`; `/release.json` version 0.5.0 matches `package.json`.
Deployed source fingerprint vs local: release.json fingerprint observed live; byte-level equality UNVERIFIED (no Vercel API proof).

## Existing defects
See DEFECT_REGISTER.md. S-001 (P3 docs version) fixed. S-002 (P2 test glob no-op) fixed. S-003 (P2 missing .env.example) fixed. S-004 (P2 no audit gate) fixed. S-005 (P2 branch protection) fixed + verified. S-006 (P3 stale branches) open.

## Initial acceptance score
Core 17/20 · E2E 15/20 · UI/UX 12/15 · Responsive 6/10 · Arch/Data 8/10 · Security 8/10 · Perf 4/5 · A11y 4/5 · Ops 4/5 = **78/100 — NOT READY** (physical-device recording BLOCKED is the gap; see RELEASE_ACCEPTANCE_REPORT.md).
