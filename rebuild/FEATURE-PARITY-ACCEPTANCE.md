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
| Captions SRT/VTT import/export | Technical notes document owner-supplied captions | Not listed in rebuild implementation | Port and test parser, timestamps, malformed files, download |
| Searchable transcript | Technical notes document searchable timestamp transcript | Not listed; rebuild explicitly says no extracted transcript | Port owner-supplied transcript search; do not imply AI transcription |
| Chapters | Technical notes list chapters | Not listed in rebuild README | Port creation, navigation, seek and export |
| Advanced annotation/redaction/mask tools | Technical notes list rectangles, arrows, highlights, opaque masks and blur; marked copies | Not listed as equivalent in rebuild README | Port full editor and rendered-copy pipeline or explicitly remove from parity scope only with owner decision |
| Structured coding-agent handoff | Not established in root README | Recursive discussion JSON documented; explicitly lacks extracted transcript/keyframes | Schema compatibility, export/import, escaping, large discussion |
| Bug reports | Technical notes list structured reports and Markdown download | Not listed | Port local report workflow and privacy controls |
| Recovery keys | Release verdict confirms management restore (not video backup) | Portable key export/import documented | Restore in a separate browser/profile, wrong key, partial restore and revocation |
| Offline behavior | Release verdict confirms offline banner/publish gate | Not established in rebuild README | Offline local workflows, queue/retry and clear publish gating |
| Upload resume/retry | Release verdict confirms per-part retry and resume | Live upload flow documented; equivalent resume semantics not established | Interrupt network mid-upload and resume without duplicate/corrupt chunks |
| Storage/capacity handling | 50 MB per clip; 10 min; 1 GB budget; 100 comments | 100 MB per upload; 10 min; 200 comments; dev R2/D1 | Confirm actual quotas, atomic reservations, concurrency, cleanup and abuse cost |
| Accessibility | 44px targets, focus, skip link, aria-live documented for Vercel | Manual keyboard/screen-reader review remains open | WCAG-oriented keyboard, focus, names, contrast, announcements, reduced motion |
| Responsive visual QA | 11-viewport re-run explicitly outstanding in Vercel verdict | 320/375/768/1120/1440 visual tests documented | Add missing breakpoints/orientations/heights and verify screenshots on candidate |
| Physical Android/iOS | Explicitly unverified in Vercel verdict | Explicitly outstanding | External device acceptance; no false certification |
| Security review | Existing CSP, IDOR/storage gateway tests; remaining P2 items listed | Independent security review explicitly outstanding | Threat model, authz, CSRF/CORS, upload validation, abuse/rate limits, secrets, data deletion |

## 3. Immediate parity blockers

1. The Cloudflare candidate README does not claim parity for captions/SRT/VTT, searchable transcripts, chapters, structured bug reports, offline behavior, upload resume, or the full mask/annotation workflow.
2. The candidate explicitly says its agent handoff export lacks extracted transcript and generated keyframes.
3. True frame-by-frame drawing and native desktop capture are explicitly roadmap items.
4. Recovery-key restore in a separate browser, real elapsed-time expiry, independent security review, manual accessibility, and physical-device QA remain open.
5. Candidate upload/comment limits differ from Vercel. Limits must be intentionally chosen and tested, not treated as automatic improvements.
6. Existing production data must not be copied, migrated, deleted, or invalidated as part of development smoke tests.

## 4. Required engineering sequence

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
