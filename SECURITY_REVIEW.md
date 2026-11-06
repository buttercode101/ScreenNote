# Security Review — ScreenNote

Date: 2026-11-06 · Commit `421eb4d` + fix set.

## Observed (verified)
- Gateway auth: "rejects missing, invalid and unregistered credentials before any operation" — test passes.
- Supabase config fails closed, never falls back to another store — test passes.
- Revoked/pending videos cannot silently retry or republish without password — test passes.
- Metadata CAS conflicts retry without losing another reply — test passes.
- `npm audit --omit=dev --audit-level=high`: 0 high; 4 moderate dev-only (c8→glob/minimatch). No production dependency at high severity.
- Branch protection: FIXED 2026-11-06 (S-005).
- No secrets in repo; `.env.example` contains names only.

## Not verified / gaps
- Unauthorised guest access to private videos: gateway tests cover credential validation, but a dedicated "guest enumerates another owner's clip ID" test was not found — UNVERIFIED. Recommend adding.
- CSP in `vercel.json` publicly exposes the Supabase project ref (`*.supabase.co`) — project refs are not secrets, but this confirms the backend identity to any reader. Accepted; noted.
- Upload content sniffing: media-validation tests cover format/size; magic-byte/polyglot handling UNVERIFIED.

## Secrets hygiene
- `SCREENNOTE_STORAGE_KEY` is server-only (Vercel env); never shipped to `dist/` — verified by grep of `api/` + `lib/` references. No credentials in this report.
