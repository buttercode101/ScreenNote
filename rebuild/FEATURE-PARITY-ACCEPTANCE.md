# ScreenNote parity and replacement acceptance

**Baseline date:** 2026-11-25  
**Canonical repository:** `buttercode101/ScreenNote`  
**Production reference:** Vercel, branch `main`, commit `5107d2f3d70ab31430e196890ae5c50335cf8d6e`  
**Replacement candidate:** Cloudflare branch `rebuild/cloudflare-web-first`, latest inspected Vercel preview commit `96d39af695b89b40d2c2710eecf37f34e7b48f84`  
**Decision:** Keep Vercel production unchanged. Cloudflare is a development candidate, not a production replacement.

This document separates documented implementation from verified parity. A feature marked "documented" is not thereby proven equivalent in the deployed candidate.

## 1. Release and deployment facts

| Item | Vercel reference | Cloudflare candidate |
|---|---|---|
| Deployment | Production deployment READY, 2026-11-08 | Cloudflare dev Worker documented live, 2026-11-25 |
| Source branch | `main` | `rebuild/cloudflare-web-first` |
| Architecture | Static browser app + Vercel Node Functions + private Supabase Storage/Postgres gateway | React workspace + Cloudflare Worker + D1 + private R2 |
| Environment | Existing production | Isolated dev resources |
| Production cutover | Serving users | Not approved |
| Domain | `screennote-woad.vercel.app` | `screennote-dev.buttercoder-dev.workers.dev` |

Evidence:
- Root README states the publishing API requires Vercel Node Functions and its private storage gateway.
- Rebuild README describes isolated Worker/D1/R2 resources and says production cutover is a separate decision.
- Latest Vercel deployment inspection: production READY on main; Cloudflare branch also has a READY Vercel preview, which is not evidence of Cloudflare production readiness.

## 2. Feature parity ledger

Status meanings:
- **Documented**: candidate README claims implementation; deployed parity still needs direct route/API/UI evidence.
- **Not established**: candidate documentation does not establish an equivalent implementation.
- **Known limitation**: candidate documentation explicitly describes a reduced capability.
- **External gate**: cannot be completed by repository automation alone.

| Capability | Vercel reference evidence | Cloudflare candidate evidence | Acceptance required |
|---|---|---|---|
| Guest-first use; no account | Root README, first-run flow | Guest sessions documented | Fresh browser, no account, complete full journey |
| Browser screen capture | Root README; launch readiness | Capture documented | Real desktop browser source picker, permission deny/retry, device changes |
| Microphone/system audio/camera bubble | Root README | Optional tracks/composition documented | Real device/track selection and truthful unsupported states |
| Pause/resume/finalize | Release verdict and capture tests | Documented | Real MediaRecorder lifecycle, interrupted capture and recovery |
| Local library / IndexedDB | Root README and technical notes | IndexedDB library documented | Persistence, quota exhaustion, corrupt data, reload and browser restart |
| MP4/WebM import | Release verdict | MP4/WebM/MOV documented | MIME and magic-byte validation, malformed and oversized inputs |
| Local trim preserving original | Release verdict | Trim to WebM copy documented | Compare original bytes and output playback/duration/audio |
| Explicit temporary publishing | Vercel live smoke and API tests | Worker lifecycle documented and live smoke reported | Real publish from UI through storage, retry and rollback |
| Expiring links (1/3/7 days) | Root README | Documented | Clock-controlled tests plus real elapsed-time expiry |
| Password-protected shares | Release verdict | Documented; lockout described | Brute force, rate limits, password rotation and enumeration review |
| Private video delivery / range seeking | Technical notes | R2 private media and byte ranges documented | Unauthorized access, range edge cases, cache headers and revoked URL behavior |
| Comments/replies/edit/delete | Release verdict | Nested comments documented | Ownership, concurrency, idempotency, refresh and deep links |
| Resolve/reopen moderation | Release verdict | Documented | All creator/author permission combinations |
| Playback bubbles and timeline markers | Root README | Documented | Seek accuracy, keyboard access, fullscreen/PiP boundaries |
| Frame-point annotations | Not established as a named shipped capability in root README | Frame-point annotations documented | Verify actual UI editing, persistence, export and mobile usability |
| Captions SRT/VTT import/export | Technical notes document owner-supplied captions | Implemented in `legacy/lib/enrichment.js` and `legacy/public/extras-ui.js`; Playwright imports, saves and exports VTT | Verify malformed/edge-case parser coverage and shared persistence on live Worker |
| Searchable transcript | Technical notes document searchable timestamp transcript | Implemented as search over owner-supplied caption cues in `extras-ui.js`; no automatic transcription | Verify cue ordering, empty search, Unicode/case handling and seek behavior; do not imply AI transcription |
| Chapters | Technical notes list chapters | Implemented in `enrichment.js` and `extras-ui.js`; chapter navigation is rendered in viewer | Verify malformed timestamps, ordering, boundary conditions and live persistence |
| Advanced annotation/redaction/mask tools | Technical notes list rectangles, arrows, highlights, opaque masks and blur; marked copies | `markup.js` and editor UI implement rectangle, arrow, highlight, opaque redaction and blur marks; marks are frame-normalized | Verify mark persistence, export/trim rendering, blur/redaction correctness, keyboard/touch usability and output pixel evidence |
| Structured coding-agent handoff | Not established in root README | Recursive discussion JSON documented; explicitly lacks extracted transcript/keyframes | Schema compatibility, export/import, escaping, large discussion |
| Bug reports | Technical notes list structured reports and Markdown download | Implemented in `enrichment.js` and `extras-ui.js`; owner-supplied fields, optional explicit user-agent inclusion and Markdown export | Verify URL credential rejection, long text, shared visibility warning and live persistence |
| Recovery keys | Release verdict confirms management restore (not video backup) | Portable key export/import documented | Restore in a separate browser/profile, wrong key, partial restore and revocation |
| Offline behavior | Release verdict confirms offline banner/publish gate | Offline/online events update the connection banner; service-worker offline library E2E exists | Verify all routes/assets cached, offline editing/import/trim, stale API failures and retry/reconnect behavior |
| Upload resume/retry | Release verdict confirms per-part retry and resume | `app.js` resumes from `upload-state`, skips acknowledged chunks and retries transfers | Verify real interrupted network resume, duplicate part idempotency, expiry/re-reservation and orphan cleanup under live R2/D1 |
| Storage/capacity handling | 50 MB per clip; 10 min; 1 GB budget; 100 comments | 100 MB per upload; 10 min; 200 comments; dev R2/D1 | Confirm actual quotas, atomic reservations, concurrency, cleanup and abuse cost |
| Accessibility | 44px targets, focus, skip link, aria-live documented for Vercel | Manual keyboard/screen-reader review remains open | WCAG-oriented keyboard, focus, names, contrast, announcements, reduced motion |
| Responsive visual QA | 11-viewport re-run explicitly outstanding in Vercel verdict | 320/375/768/1120/1440 visual tests documented | Add missing breakpoints/orientations/heights and verify screenshots on candidate |
| Physical Android/iOS | Explicitly unverified in Vercel verdict | Explicitly outstanding | External device acceptance; no false certification |
| Security review | Existing CSP, IDOR/storage gateway tests; remaining P2 items listed | Independent security review explicitly outstanding | Threat model, authz, CSRF/CORS, upload validation, abuse/rate limits, secrets, data deletion |

## 3. Independent frontend acceptance

The Cloudflare application now has its own React 19 + TypeScript + Vite entrypoint and an independent design system. The build no longer bundles or serves the legacy Vercel HTML, CSS or browser JavaScript. The legacy source is retained only as a migration/reference corpus.

Verified by the rebuild workflow:
- React entrypoint is served from `/src/main.tsx` in development and the Vite-generated asset bundle in production.
- The legacy `/app.js` and `/style.css` requests are absent from the new frontend.
- Independent warm-paper / near-black / acid-lime visual language, Space Grotesk / Source Sans 3 / DM Mono typography, and custom recording/library composition.
- Playwright responsive checks at 13 viewport widths, light and dark themes, import/preview/share journey, and no horizontal viewport overflow.
- Build and deployed live API acceptance run separately; the existing Vercel production deployment is not modified.

The frontend is independent; the service is not yet fully Vercel-independent. A compatibility fallback remains for the old `/api/clip` contract so existing legacy shares are not silently abandoned. The new React frontend uses Cloudflare's Worker API for new sharing flows.

## 3A. 25 November implementation update — pending full acceptance

The Cloudflare branch has moved beyond the earlier primary-flow-only UI. The following capabilities are now surfaced in the independent React application. They are **implemented in the branch**, but must not be marked release-accepted until the current Worker build, live D1/R2 smoke, Playwright evidence and failure-path tests pass.

| Capability | Current implementation | Remaining proof |
|---|---|---|
| Separate Preview and Edit | Dedicated playback preview and editing workspace; recording cards expose both actions; post-publish toast has Open preview and Copy link | Deployed navigation, keyboard and viewport checks |
| Local editing | Editable title, trim-to-new-copy, preserve-original behavior | Verify source/output playback, audio, duration and metadata retention |
| Markup | Rectangle, arrow, highlight, blur and opaque redaction; undo/clear; annotated-copy export | Verify actual encoded pixels, blur/redaction boundaries, audio continuity and long-video behavior |
| Captions/transcript | Owner-supplied SRT/VTT import, cue validation, local search and timestamp seeking | Live share round-trip, Unicode and malformed-file acceptance |
| Chapters | Timestamped chapter editing and viewer navigation | Live share round-trip and edge cases |
| Bug reports | Structured fields and Markdown export; explicit shared-visibility notice | URL and long-text security cases; live viewer acceptance |
| Review status | Needs feedback / changes requested / approved stored in local clip and shared context | Live D1 persistence and viewer permissions |
| Shared context | Owner-key protected Worker endpoint; viewer displays captions, transcript search, chapters, annotations and report | Real deployed D1 migration and password-gated read/write checks |
| Anonymous reactions | New D1 `share_reactions` table and `/reactions` API; one like/thanks/idea reaction per browser key, with counts and removal | Live share test, one-vote identity, 500-voter limit and UI accessibility |
| Portable library backup | ZIP export/restore includes local media, editing metadata and private share-management keys; duplicate-safe restore; thumbnails are regenerated on restore | Device storage/quota, corrupt archive, large archive and separate-profile restore |
| Library thumbnails | Locally generated JPEG preview frames for imported, recorded, trimmed and annotated copies; lazy generation for older clips | Low-memory mobile decoding and large-library performance |
| Recording setup | 720p saver / 1080p balanced / up-to-1440p clear profiles, microphone source refresh/selection, system audio, camera bubble size/corner, 3-second cancellable countdown, pause/resume | Real device/source picker tests; unsupported mobile browser behavior |
| Offline behavior | Connection banner; local preview/edit/download remain available; publishing is blocked offline | Offline reload/cache behavior and reconnect/resume |
| Resumable share upload | 2 MiB chunks, D1 part state, R2 part objects, bounded streaming assembly, retry helper, local pending-reservation state and progress | Live interrupted-network resume, duplicate part idempotency, expired reservation, cleanup and storage-abuse tests |

Important distinctions:
- Captions are owner-supplied. There is no automatic speech-to-text transcription.
- The current markup tools apply spatial marks to the video image; they are not a frame-by-frame keyframe editor.
- Camera placement now offers four corners plus independent custom horizontal/vertical positioning sliders and size selection; direct drag-to-position remains a usability improvement.
- Resumable upload uses application-level R2 part objects and a streamed final assembly, not R2's native multipart API.
- Browser viewport emulation is not physical Android/iOS acceptance.

## 4. Immediate parity blockers

1. The advanced editing and context surfaces have now been added to the React frontend, but their deployed integration and output correctness are still being verified. The new features must not be called complete until the live workflow and artifact checks pass.
2. Automatic transcript extraction, generated keyframes and frame-by-frame keyframe editing are not implemented. Transcript search is over owner-supplied captions only.
3. Camera bubble drag positioning is not yet restored; only size and four-corner placement are available. Native desktop capture remains browser/platform-dependent.
4. Recovery-key restore in a separate browser, real elapsed-time expiry, independent security review, manual accessibility and physical-device QA remain open.
5. Candidate upload/comment limits differ from Vercel. Resumable uploads now exist in the new Worker API, but interruption/retry/expiry and storage-abuse acceptance remain open.
6. Existing production data must not be copied, migrated, deleted, or invalidated as part of development smoke tests.

## 5. Required engineering sequence

### Gate A — source inventory
Enumerate every route, screen, state, browser capability, API operation, data model, migration, background task, and user-visible promise in both implementations. Map each item to exact source files and tests. This ledger is a starting point, not a substitute for source-level inventory.

### Gate B — feature restoration
Implement every missing Vercel capability on Cloudflare, preserving local-first originals, explicit publishing, anonymous viewing, temporary retention, recovery controls, and existing privacy promises. No mock API may count as integration acceptance.

### Gate C — backend and data correctness
Test D1 transaction/concurrency behavior, R2 multipart/resumable uploads, orphan cleanup, expiry, range reads, deletion, rate limits, token rotation, idempotency and storage quota failures. Test with synthetic data only. Never touch production user data.

### Gate D — product and UI quality
Audit all routes and interaction states in light/dark mode at 320, 360, 375, 390, 414, 600, 768, 834, 1024, 1120, 1280, 1440 and 1920 CSS px; include short landscape heights, zoom, long text, keyboard, touch and screen-reader paths. Repair overflow, focus, contrast, target size, motion and empty/loading/error states.

### Gate E — independent acceptance
Run the same black-box journey suite against Vercel and Cloudflare using equivalent synthetic fixtures. Compare outputs, permissions, media bytes, discussion data, expiry and failure behavior. Add tests for every discovered mismatch. Passing candidate-only tests is insufficient.

### Gate F — cutover safety
Only after all prior gates pass: rehearse backup/restore, define an explicit data migration and rollback plan, verify domain/TLS/cache/security configuration, run production smoke tests with synthetic content, and obtain a separate production cutover decision. Vercel remains available until rollback is proven.

## 5. Non-negotiable acceptance criteria

- 100% of shipped Vercel capabilities have an explicit disposition and evidence.
- No silent loss of data or capability.
- No test relies solely on mocked backend responses for an end-to-end claim.
- Every critical user journey passes on the deployed Cloudflare candidate.
- Security and privacy behavior is at least as strong as the reference.
- UI and accessibility regressions are fixed, not waived to make CI green.
- Physical-device limitations are disclosed honestly.
- No production migration or destructive action without a verified backup and explicit cutover authorization.

## 6. Current verdict

**Cloudflare development backend: promising, partial acceptance evidence.**  
**Feature-complete replacement: not established.**  
**Production replacement: not approved.**

The next engineering work must be source-level inventory and parity implementation, not another claim of completion based on a narrow smoke suite.
