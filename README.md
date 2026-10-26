# ScreenNote v0.3.3

Record a short screen message, review it locally, and explicitly publish a clean viewer with timestamped replies and reactions. This is the second product following InvoiceFlow, implemented independently without inspecting or copying proprietary software.

## Storage capacity release — v0.3.3

The 16-slot restriction is removed. Shared videos draw from a 1 GB (1,000,000,000-byte) storage budget, with temporary chunks and assembly accounted for atomically. Pending uploads reserve twice their size; successful publication releases temporary capacity only after chunk cleanup. Existing reservations are migrated without changing videos or owner keys. The healthy connected organization is on Supabase Free. Its nominal file storage quota is organization-wide; other projects and provider usage restrictions still apply. No plan upgrade is enabled. The 25 MiB per-file limit remains.

About 37 maximum-sized videos fit when uploaded sequentially into an otherwise empty budget, or hundreds of smaller videos. Simultaneous pending uploads reserve extra space. Expired/abandoned uploads are reclaimed under capacity pressure using a bounded cleanup batch. Health reports the actual reserved and remaining budget. Egress and hosting quotas are separate limits, not guaranteed viewing capacity.

See verification/storage-capacity-2026-10-26.md for acceptance evidence.

## Previous verified release — 26 October 2026

Version 0.3.2 repaired the mobile review/share flow, intrinsic square/portrait playback, generated filename titles, owner-authorized published title edits, trusted container/track validation and diagnostic build labels. All 81 local tests pass, GitHub verification succeeds, and real preview/production checks passed for square MP4 and password-protected browser-trimmed WebM, including feedback, owner denial, title changes, byte-identical downloads, revocation/deletion and invalid-container rejection. See [verification/mobile-media-fixes-2026-10-26.md](verification/mobile-media-fixes-2026-10-26.md) for fresh evidence and precise scope. Physical handset and native hardware acceptance are still not certified. The synthetic UI-only upload was subsequently deleted after explicit approval. Existing user recordings remain intact.

## Stack

Buildless-style HTML/CSS with an esbuild-bundled browser app; Vercel Node Functions; private Supabase Storage and Postgres via an authenticated server gateway. The gateway secret stays in Vercel; the Supabase service role stays in the Edge Function. No paid AI, editor suite, account provider or payment service. Hosting remains subject to the connected free-tier quotas; unlimited capacity is not promised.

## Behavior

- Screen capture uses the browser's mandatory source picker. Optional microphone, system audio and composited camera bubble. Native capture requires HTTPS and a compatible desktop browser.
- Imports playable MP4/WebM files; phones without browser screen capture can import device recordings.
- Local IndexedDB library and incremental recording recovery chunks. Local storage is not a backup; download important videos.
- Real local trim creates a new encoded file at playback speed, retaining the original; keep the tab open while processing.
- Sharing uses bounded same-origin chunk transfers with private server-side assembly, private media, expiring playback URLs, and a clean `/v/:id` viewer. Sharing is explicit, never automatic.
- Choice of 1, 3 or 7 day link expiry, timestamped comments, anonymous reactions and owner-controlled stop sharing. Issued playback URLs may persist for five minutes after stop-sharing.
- Five minutes / 25 MB per clip; shared storage uses a 1,000,000,000-byte budget. Reservations account for temporary assembly copies; the count depends on video sizes. A 10,000-record metadata safety bound also applies. When capacity is full, new reservations reclaim expired uploads and abandoned reservations after an extra 24-hour grace period. Cleanup is demand-driven; a scheduled deletion job is not configured.
- Owner management capabilities can be exported as private recovery-key JSON and restored at the same origin after changing browsers or clearing local data. Export first: without the original keys, ownership cannot be recovered. Recovery files do not include videos. Viewer names and browser reaction identifiers are not verified identities.
- Vercel protection settings are retained. An unauthenticated HTTP check of the production health endpoint returned 200; the shared viewer also played in the browser.

## Development

`npm ci`, `npm test`, `npm run build`. Apply the checked-in Supabase migration and deploy `supabase/functions/screennote-store`. Register the SHA-256 hash of a cryptographically random 32-byte gateway key in `screennote_gateway_keys`, then configure the same key as server-only `SCREENNOTE_STORAGE_KEY` and the project URL as `SUPABASE_URL` in Vercel. Never expose storage credentials in the browser. The legacy Blob adapter remains for existing deployments without Supabase configuration; a configured Supabase backend never silently falls back after a failure. A static local preview supports local import/review/trim/download; the sharing API runs on Vercel.

## Verification status

73 automated API, recording-lifecycle, rules and Supabase gateway tests cover reservation/publication, owner authorization, expiry/revocation, reaction deduplication, comment idempotency, cross-origin rejection, capacity, upload limits, media sniffing, secure ID fallback and ordered recovery writes after storage failure. These use a simulated store and do not replace a live Blob integration test.

Browser-tested import of the bundled seven-second sample, persistence after reload, local trim and actual video download. The first trim test exposed a silent-audio bug; the corrected three-second download has VP8 video and measurable Opus audio (mean -21.1 dB). Live upload/viewer/reply checks and final deployment evidence are recorded in the completion report. Native screen/camera/microphone permission-picker flows and physical mobile devices are not yet verified end to end.

Current feature and release gates: [LAUNCH-READINESS.md](LAUNCH-READINESS.md). Captions, transcripts and bug reports are owner supplied; no automatic transcription runs. Canonical source is https://github.com/buttercode101/ScreenNote. Older links from the suspended Blob service cannot be copied while reads are denied. Refresh shared status on the original local recording and publish a replacement; preserve old recovery keys. Do not claim historical media was migrated.

Previous UI audit: [UI-QA-2026-10-23.md](UI-QA-2026-10-23.md). Earlier source and production audit: [AUDIT-2026-10-23.md](AUDIT-2026-10-23.md). The deployment remains constrained early access; see the recorded unverified boundaries.

## Replaying UI failure cases

Run `npm run build`, then `node scripts/prepare-qa.mjs`. Serve `dist` locally and open `/matrix.html`. Its isolated IndexedDB cases cover long content, interrupted drafts, failed storage, permissions, offline sharing, upload failure and clipboard failure. Canvas and Web Audio simulate capture inputs; real MediaRecorder, trimming and IndexedDB run in the browser. Widths span 320–1920 CSS pixels, with controls for short landscape heights and delayed requests. These fixtures use simulated API responses, never production uploads. Run `npm run build` again before deployment: it deletes QA assets from `dist`. Production builds copy only `public` and bundle the app.

## Production audit 24 October 2026

Version 0.2.1 fixes navigation scroll/focus, dialog focus restoration, the Help selection, stacked home layout and unsupported capture presentation. Storage adapter failures return retryable 503 responses. Zod is pinned to patched 4.6.7 through an override; remove it once the upstream dependency is patched. See AUDIT-2026-10-24.md for evidence and limits.

For an explicitly authorized production smoke test with non-sensitive synthetic media: `node scripts/live-smoke.mjs https://your-app.example /absolute/synthetic-15-second.webm`. This creates two test uploads, exercises feedback/access controls and deletes only those uploads. Requires curl and capacity for two reservations.

## User journey repairs, 25 October 2026

Version 0.2.2 adds cancellable pending capture, portrait-aligned annotation previews, verified-container fallback for missing file MIME, synchronous audio unlock for local processing, actual storage health probes, a sharing connection retry, and bounded setup/finalization retries. 64 automated tests pass. See AUDIT-2026-10-25.md for fresh user-side evidence and remaining device limits.

Version 0.2.3 distinguishes suspended/denied storage access from transient errors, avoids retrying that condition automatically, and shows service availability across owner screens. 66 automated tests pass. As of 25 October 2026, the actual connected store is quota-suspended: online sharing and shared playback are blocked until account storage access is restored. Do not call the live product end-to-end certified.

## Supabase migration release

Chunk status is queried before retries so already saved complete parts are skipped. Metadata uses revision compare-and-swap with bounded conflict retries; comments and reactions are persisted in separate Postgres rows. All tables have RLS and no browser-role access; RPC functions are service-only. The private bucket rejects public configuration. Existing local recordings remain intact. See PROJECT-ENGINE-AUDIT.md for current release evidence and limitations.

Approved production verification on 26 October 2026 passed for protected and unprotected three-part uploads, actual resume, byte-identical playback, owner authorization, feedback idempotency/concurrency, revocation and deletion. All four synthetic uploads and their records/feedback were removed; no active test reservations remain. Native and physical-device gates remain open. See PROJECT-ENGINE-AUDIT.md and verification/live-sharing-2026-10-26.json.
