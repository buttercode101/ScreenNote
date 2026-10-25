# ScreenNote 0.2.0 verification record

23 October 2026. New work extends the existing app; it does not replace the recorder or its storage architecture.

## Automated evidence

57 tests pass. New tests cover caption import/export and literal-text round trips, invalid/out-of-range captions and chapters, report URL/length validation, trim timestamp rebasing, transient transfer retries, deferred capture setup and selected microphone constraints, password-gated metadata/media/feedback, password-attempt throttling, invalid-password reservation rollback, expiry choices and owner-only context updates. Existing tests still cover publication, upload boundaries, owner authorization, revocation, retention, recovery, lifecycle and capacity.

Clean build, source syntax and whitespace checks pass. A deterministic application-source fingerprint is emitted in `release.json`. Internal matrix/fixture assets are excluded from a clean production build.

## Browser evidence before publication

- SRT/VTT text and chapters saved in a local video context; bug-report fields saved without automatic diagnostics. Viewer search found the matching caption, and clicking it moved actual playback to 3.016 seconds. Speed control reported 1.5× with readyState 4 and no media error. Picture-in-picture click produced no application error; native window appearance is not certified.
- Opaque mask drawn by an actual pointer drag, then saved to a separate marked video. Actual download was decoded: 7.008 seconds, VP8/Opus, 218,266 bytes. The mask region in the decoded frame was uniformly opaque (RGB standard deviation 0 across a 580×180 interior region), covering the source text. Original video and context were preserved.
- Recording setup with selected synthetic microphone, camera and shared audio; cancellation during countdown returned to the library. A fresh countdown started capture. Pause/resume and Alt+Shift+P / Alt+Shift+S operated actual MediaRecorder. Recording saved locally.
- Storage-quota failure after the new setup/countdown flow retained a download; the emergency screen rendered, download was clicked, and acknowledgment returned to the library. No repeated error-scrolling loop returned.
- Beta help and local test-report form were completed; a JSON report downloaded without sending personal information or feedback to a server.
- Responsive sweeps used all 17 widths from 320 through 1920 CSS pixels, including each requested breakpoint and its adjacent pixel. Screens included library, populated/local/shared/recovered/offline editors, expanded captions/report and annotation tools, enriched viewer, privacy, recovery, help, feedback dialog, owner revoke/delete dialogs, capture setup, paused recording, emergency and unavailable/storage-error screens; dark and 360px landscape-height checks were included. No visible document/control overflow was found. The initial detector counted stale rectangles inside a closed `details` element; excluding non-rendered descendants removed this false positive and the shared editor was rechecked.

Device streams and API failures in the matrix are simulations. Browser MediaRecorder, Web Audio, canvas composition, IndexedDB, trimming, pointer interactions, downloads and video decoding are real. Those observations must not be described as physical-device or native-permission acceptance.

## Source and commercial boundaries

The public GitHub repository was independently found empty. Source write failed with the integration's 403; it remains unsynchronized. The complete release is preserved through the existing source repository and archive. The GitHub CI workflow is included but remote execution has not been observed. Vercel billing queries returned `costs_not_found`, so actual account cost and commercial margin remain unverified. See [LAUNCH-READINESS.md](LAUNCH-READINESS.md) for phase-by-phase gates, sources and validation protocol.

Production provenance check found identical uploaded source files and built JS/CSS but a fingerprint difference isolated to Vercel rewriting `vercel.json` at build time. Application fingerprints exclude that platform-processed manifest; security headers and uploaded source configuration are verified separately. Installation now uses `npm ci` for reproducibility.

The final live owner-revoke check exposed a metadata-write conflict. The Blob metadata adapter now explicitly enables overwrites only alongside a matching ETag and backs off between bounded contention retries. Three adapter-level regressions enforce create-only insertion, concurrent update preservation, bounded retries and propagation of ordinary provider failures. This fixes a gap hidden by the API tests’ simulated store. The final live retest must confirm revocation and cleanup before release completion.

Live tracing isolated the remaining failure: GET returned a weak 36-character ETag while Blob head returned a strong 34-character revision. Compression-sensitive JSON reads now request identity encoding. A fallback accepts a canonical strong revision only when it identifies the same generation; an intervening version forces a fresh body read, and an unverifiable version fails closed. Four additional regressions cover these boundaries. Retried dialogs also clear stale errors before sending again.

After the strong-revision fix, owner revocation completed in the production browser and independent owner metadata reported revoked; the viewer returned 404. Upload retries and republishing additionally require an explicit password for previously protected videos; a pending upload cannot silently change its original password. Three additional regressions cover these protection-preservation cases.
