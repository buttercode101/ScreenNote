# Defect Register — ScreenNote

Date: 2026-11-06 · Starting commit `421eb4d` · Tested with fix set below.

## S-001 — README version stale (P3, FIXED)
- `README.md:65` said 0.4.0; `package.json` + live `/release.json` are 0.5.0. Fixed to 0.5.0.

## S-002 — Test glob `tests/ui/*.test.js` matched zero files (P2, FIXED)
- `package.json` test script included a glob covering zero files (`tests/ui/` holds `.js` fixtures without `.test.js`), so "all suites" didn't include UI fixtures — a false-coverage signal.
- Fix: removed the no-op glob; `npm test` now honestly runs `tests/*.test.js` (112 tests). UI fixtures documented as manual-browser in ACCEPTANCE_TEST_PLAN.md.
- Retest: 112/112 pass.

## S-003 — No `.env.example` + gitignore blocked it (P2, FIXED)
- Required vars (`SUPABASE_URL`, `SCREENNOTE_STORAGE_KEY`, legacy `BLOB_*`) documented only in `docs/TECHNICAL-NOTES.md`. `.gitignore` had `.env*` with no exception, so even a committed example would have been ignored.
- Fix: added `.env.example` (names only, no values) + `!.env.example` exception. Verified `git check-ignore` now reports no ignore and `git status` shows `?? .env.example`.

## S-004 — No dependency-audit gate in CI (P2, FIXED)
- `verify.yml` ran test + build only. `npm audit --omit=dev --audit-level=high`: 0 high (4 moderate dev-only via c8). Adding the gate is safe and now passes.
- Fix: added audit step to `verify.yml`.

## S-005 — No branch protection on main (P2, FIXED + VERIFIED)
- Evidence: protection API → 404 before fix.
- Fix: PUT protection — strict, required contexts [`test-and-build`, `build`] (verified exact names via check-runs for `421eb4d`), `enforce_admins=false`, force-push/deletion blocked.
- Verification: re-GET confirms contexts, strict=true, force=false (2026-11-06).

## S-006 — 18 stale remote branches (P3, OPEN)
- Cleanup deferred pending owner confirmation of branch list (same policy as ContractCheck D-006).

## Accepted risks (not defects)
- 1 GB Supabase Free budget is organisation-wide and shared; egress/bandwidth unbudgeted; no spend alert. Documented in LAUNCH-READINESS.md cost model. Mitigation (alerts/quota) needs owner account action.
- `vercel.json` CSP publicly exposes the Supabase project ref — not a secret, noted in SECURITY_REVIEW.md.
- Physical-device + native capture acceptance open (LAUNCH-READINESS Phase 2) — BLOCKED, not a code defect.
