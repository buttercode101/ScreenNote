# ScreenNote v0.1 · 22 October 2026

## Implemented

Browser screen recording with optional microphone, shared-screen audio and composited camera bubble; pause/resume/stop; incremental recovery chunks; local video library; MP4/WebM import; real local trimming into a new video; download; explicit private-storage publication; seven-day unlisted viewers; expiring media URLs; timestamped comments and anonymous reactions; stop sharing and uploaded-video deletion; light/dark themes and responsive layouts.

This is a constrained first build, not a commercially validated or universally compatible recorder. No proprietary software was inspected or copied.

## Evidence

- 16 automated tests pass: metadata limits, trim bounds, input validation, public-data redaction, container signatures, secure IDs, recorder lifecycle/permission rejection/cleanup, API reserve/publish/view flow, owner authorization, expiry/revocation, bounded capacity, reply idempotency, reaction deduplication, cross-origin rejection and small-transfer checks. Storage/API tests use a simulated repository; recorder tests use simulated media devices.
- Build and JavaScript syntax checks pass. Dependency audit found no known vulnerabilities; this is not a security certification.
- Actual browser: sample import, local preview, reload persistence, real trim from seconds 1–4, separate original and trimmed records, actual trimmed download.
- Corrected trimmed output is 3.000 seconds, VP8 video and Opus audio, 173,084 bytes; mean audio volume -21.1 dB and max -17.8 dB. First attempt was silent (-91 dB); fixed by routing an unmuted media source to the recording destination rather than speakers. Files were inspected using ffprobe/ffmpeg.
- Chromium-produced/fixed WebM was playable but ffprobe emitted an unknown-sized-element warning. Native MediaRecorder containers vary; this is recorded rather than hidden.
- 24 document-overflow checks passed: Library, Editor and Privacy at 360, 390, 480, 768, 834, 1024, 1440 and 1920 CSS pixel iframe widths. Actual client widths matched target or target minus 15px scrollbar. This is not physical-device verification.
- Live backend: unauthenticated production health returned 200 and configured=true. A real synthetic upload through the SDK completed and finalized in private Blob storage.
- Live viewer `/v/554481f1-7468-472a-a8e0-3cd93744bba2`: browser media readyState=4, duration=7.008s, currentTime advanced to 1.168s, paused=false, no media error. Posted a named timestamped reply containing literal `<literal text>` and observed it rendered as text. A Helpful reaction persisted at one.
- First progress-enabled browser upload stalled at 0%. Bounded same-origin chunk transfers and server-side assembly were added for all supported clip sizes. The final browser retest is recorded after deployment.

## Limits

Five minutes and 25 MB per shared clip; total early-access capacity is 16 upload reservations. Hosted storage/transfer remains subject to Vercel account limits and billing; unlimited free usage is not promised. No paid upgrade or AI service is configured.

Sharing expiry prevents new viewer access, but is not automatic physical deletion. Existing signed playback URLs can work up to five minutes after revocation. Cloud deletion is available to the owner browser; ownership recovery after clearing browser data is not implemented. Names and reaction identifiers are not verified identities.

Native screen-picker, real camera/microphone/system-audio combinations, interrupted-recording recovery and physical Android/iOS/Safari usage remain unverified end to end. The native permission UI is outside the available browser automation surface. Screen capture support is detected, and unsupported environments are directed to import.

## Release trail

Initial source 7f8c173065aa8c3e0c68a2559c3c7cc07836edd4, then transport fixes at 06444ab0b4967f61fdb08e0d9c5570bb616d9ff2. Production origin: https://screennote-woad.vercel.app/. Final source/deployment and final transfer test appear in the completion record.

## v0.1.1 audit — 22 October 2026

Review covered every application source module, API handler, storage adapter, build configuration, styles, and tests. Baseline: 16 tests passed, production health configured, browser sample imported successfully. Prior verification claims above are historical, not substituted for this run.

Fixed: cloud deletion now clears partial uploads and releases capacity only after successful cleanup; revoked links keep deletion controls and ownership locally; expired links display inactive status; failed publication exposes upload deletion; retry after a lost publication response skips re-uploading immutable parts; pending retries synchronize titles and validate file identity; expired upload reservations reject direct publication; malformed payloads, unexpected GET operations and misleading MIME prefixes are rejected; reply retries reuse their event ID; reaction requests serialize; refresh renews playback and reaction counts; import actions are guarded; empty rename preserves original title; trim decode/seek/stall timeouts and Web Audio fallback; narrower layout containment and larger timestamp controls; optional microphone is enabled by default on supported browsers.

Current checks: 22 automated tests (injected storage/media, not live integration), syntax checks and production build. Browser-local sample import, persisted original and real 1–4 second trim observed. Live storage and post-deployment checks are recorded separately after execution.

Remaining constraints: 16 global reservations; abandoned reservations and expired uploaded media have no scheduled reclamation. No accounts or owner-capability recovery after clearing browser storage. Browser capture compatibility and permission prompts vary. Physical Android/iOS and native screen/camera/microphone source pickers have not been tested in this environment. These constraints prevent a universal zero-failure or unrestricted production-scale claim.

## Follow-up on 23 October 2026

v0.1.2 supersedes the earlier ownership and retention limitations with opt-in recovery-key export/import and capacity-triggered cleanup with grace periods. See [AUDIT-2026-10-23.md](AUDIT-2026-10-23.md) for current evidence and remaining constraints.
