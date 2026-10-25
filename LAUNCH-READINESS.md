# Current blocker — 25 October 2026

Live online sharing is blocked. The connected private Blob store screennote-media (store_JL1iAHQb3zzX1czO) reports billingState suspended, usageQuotaExceeded true and status limits-exceeded-suspended. Actual private reads return 403 Forbidden. The configured token is linked to this same project/store; it is not evidence of a healthy service. Do not certify publication or shared playback until account storage allowance/access is restored and a fresh live user-flow test passes. No paid plan change, replacement store, public access weakening or migration was performed. Local import, processing and download remain available. No reset date or account-specific charge is inferred.

# ScreenNote 0.2.0 — release gates and operating model

23 October 2026, South Africa. This file distinguishes implementation from acceptance evidence. A beta release is not a commercial readiness certification.

## Phase 1: source and runtime truth

The connected public GitHub repository `buttercode101/ScreenNote` returned “This repository is empty” on 23 October. The working source was held in the existing Sites source project `appgprj_6ad9db91dbb08191986b875d90d7e732`; production is the Vercel project `prj_d3BUevPyfC7Dzcw5TR0vDGS3wIOa`, at https://screennote-woad.vercel.app/. Static Sites hosting cannot execute its Node API and must not replace the Vercel runtime.

Version 0.2.0 adds deterministic `/release.json`: version plus a SHA-256 fingerprint over deployable public, API, library, script and package files (hosting configuration is checked separately). Compare production against a clean local build. Repository commits and deployment IDs are recorded separately; the fingerprint verifies source content without pretending unrelated Git providers share a commit history. A CI workflow is included for installation, tests, a clean build and exclusion of internal QA pages; remote CI execution has not been verified. No environment files or bearer capabilities belong in Git. The attempt to initialize the public repository was rejected with `403 Resource not accessible by integration`; reported user push permission does not grant this integration repository write access. The public repository remains unsynchronized; the existing source repository and full source archive preserve this release.

## Phase 2: device acceptance

Browser QA can exercise real MediaRecorder/compositing, IndexedDB, transforms, downloaded video bytes and responsive CSS with simulated device streams. This does not certify native permissions or real physical devices. No physical device lab is connected here.

Before a commercial launch, gather at least these reports using Help & beta → Create a test report. No identity or automatic diagnostics are required. Record browser/version, device, task, result and evidence privately; never include passwords or personal recordings in reports.

| Device | Required acceptance task | Current gate |
| --- | --- | --- |
| Desktop Chrome and Edge | Native screen/window/tab selection, decline/retry, selected microphone, camera, tab audio, setup cancellation, 5-minute capture, browser Stop | Physical/native acceptance outstanding |
| macOS Safari | Native capture where exposed, camera/mic, MP4/WebM import, trim, playback, download | Physical/native acceptance outstanding |
| Android Chrome, inexpensive handset | Device-recorded MP4 import, rotation, review, trim, upload, viewer/reply, background interruption and storage pressure | Physical acceptance outstanding |
| iPhone/iPad Safari | Device-recorded video import, portrait/landscape, share/download, controls, captions | Physical acceptance outstanding |
| Tablet 768–834 and 834–1024 CSS pixels | Expanded context and mask tools, keyboard/focus, portrait/landscape, no clipping | CSS simulation covered; physical acceptance outstanding |

Mobile capture is capability-detected, not promised. Unsupported browsers use the import path. Tests must confirm no recording is lost on a failed share and no audio track is claimed when the browser did not provide it.

## Phase 3: focused improvements

Implemented: setup before capture; cancellable three-second countdown; microphone selection when device labels are available; live rectangles/arrows/highlights; fixed opaque masks and soft blur effects baked into video; new marked-copy export preserving the original; local thumbnail selection; caption SRT/VTT import/export; searchable timestamp transcript; chapters; structured bug reports with optional, explicit user-agent inclusion; Markdown report download; viewer speed, picture in picture when supported, keyboard shortcuts; automatic bounded transient transfer retries and progress; 1/3/7-day expiry and optional server-verified sharing passwords.

Opaque masks are for redaction. Blur is an effect, not a guarantee of secrecy. Masks are fixed to the frame; moving content may escape them. Setup permits masks before the first recorded frame. Masks added later cannot protect earlier frames; the saved-copy tool applies fixed masks throughout a new video. Review every generated copy before publication. On another screen/window, return to the app to change marks; there is no invisible cross-application annotation toolbar or extension.

Captions are owner-supplied and editable; no automatic transcription accuracy is claimed. Native browser speech recognition is inconsistent and can send audio to browser-vendor services; large local speech models impose mobile download/CPU costs. Paid AI was deliberately deferred as recommended until a sustainable, consent-based processing approach is validated. Complex multi-clip editing, enterprise workspaces, browser extensions and meeting summaries remain deferred rather than falsely represented as implemented.

## Phase 4: constrained free beta

No card, account, subscription or paid upgrade is enabled. Local recording/review/download does not use an AI API. Online sharing uses the hosting account's private Blob and Functions allowances. Limits: 16 global active/pending reservations, five minutes, 25 MiB, 100 replies and 500 reaction identifiers per clip. Each owner can revoke or delete their upload; expired/reserved objects are reclaimed under capacity pressure after a grace period, not on a guaranteed deletion schedule. Back up recovery keys and videos separately.

### Cost model, not a promise of free unlimited hosting

Primary pricing references checked on 23 October 2026:

- https://vercel.com/docs/vercel-blob/usage-and-pricing
- https://vercel.com/pricing
- https://vercel.com/docs/pricing/regional-pricing

Blob charges distinguish stored GB-month, simple/advanced operations, transfer and CDN requests. Rates and included allowances depend on plan/region; verify them in the account before charging users. The account invoice, current region, actual usage and tax/exchange rate were not available as verified inputs here. No fabricated Rand price or margin is published.

Capacity arithmetic: 16 × 25 MiB = 400 MiB of finalized media, plus metadata and temporary upload parts. Pending parts and assembled files may coexist, so transient storage can be roughly twice finalized media. Ten full views per maximum-size clip would transfer about 3.91 GiB; partial playback, repeats, range requests, captions/replies and retries change actual usage. Metadata reads/writes, signing, multipart assembly and cleanup also consume service operations and Functions resources. This is not a spending cap: public readers can produce repeated bandwidth costs.

Before raising capacity or selling subscriptions: inspect the hosting plan's commercial-use terms; verify current region/rates and a spend alert/hard cap through the account owner; measure at least a small cohort's actual transfer, failures and retention; calculate conservative unit economics, including abuse and support. Keep current upload limits until those results support expansion. No plan upgrade or billing change is made automatically.

### Small real-user validation protocol

Invite a small cohort through channels the owner chooses; no unsolicited messages are sent by this implementation. Each participant should create one non-sensitive explanation and send it to a consenting recipient, who watches, searches a caption, seeks a chapter, replies and reacts. The creator exports a backup and recovery keys, revokes the share, and checks the recipient cannot refresh access. Record task completion, time, recording loss (must be zero), upload failures, playback/audio failures and confusing controls. Collect reports with the built-in local report form; no analytics or user details are silently collected.

Commercial gate remains open until real device reports, real user feedback and account-specific costs are validated. Implemented launch safeguards are useful preparation; they do not substitute for these results.

Billing evidence: the connected Vercel charges endpoint returned `404 costs_not_found` for both the requested recent range and the last complete UTC day. No invoice-level usage or actual margin can be inferred from that result. This is an unresolved launch input, not evidence of zero charges.
