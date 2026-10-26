# ScreenNote 0.3.1 — permission recovery patch
26 October 2026, South Africa

## Finding and fix
P2: Capture.start remained pending after cancellation if the browser's getDisplayMedia/getUserMedia request never settled. A new regression failed on the original source with "Setup stayed pending after cancellation".

The patch races each native media permission request against explicit cancellation and a 60-second deadline. Cancellation rejects setup immediately. Timeout returns control with instructions to dismiss any native prompt and retry/import. A stream granted after timeout/cancellation is stopped immediately. The native request still runs synchronously within the user's click; no background capture or automatic permission approval is introduced. Cancelled captures cannot begin later.

The application cannot programmatically dismiss every browser's native picker. This patch bounds app-side waiting; it does not certify native picker behavior.

## Verification
- 75/75 automated tests pass; clean build, JavaScript syntax and whitespace checks pass.
- Regression checks cover a never-settling picker, immediate cancellation, late screen/device grants, acquired-screen cleanup, selected microphone and existing recording lifecycle.
- Isolated browser fixture with a never-settling permission request: timeout returned to My recordings, displayed the actionable error and left zero recordings.
- Before the patch, the app cancellation control already returned to the library in the isolated browser fixture; the production managed-browser no-response observation must not be represented as a proven app click-handler defect.
- Real MediaRecorder with explicitly generated screen, camera, microphone and shared-audio streams: setup, three-second countdown, Pause at 0:19 (timer remained 0:19), Resume, Stop, library persistence and reopening in a separate full-page tab succeeded.
- Downloaded synthetic output: 1,423,169 bytes; 27.6344 seconds; VP8 960x540 plus Opus 48000 Hz stereo. Browser readyState 4, no media error. ffprobe still emits the previously documented nonfatal WebM unknown-sized-element warning.
- Expanded editor and recipient viewer checked at iframe widths 320, 390, 480, 768, 834, 1024, 1600 and 1920 CSS pixels. At each, document scrollWidth equalled clientWidth (305/375/465/753/819/1009/1585/1905 after 15px scrollbar). This is viewport emulation, not physical devices.
- Simulated-service viewer: transcript search for literal text, seek to 3.03 seconds, 1.5x playback, and a literal script-like reply rendered safely; submit became enabled again.
- Preview rebuild briefly invalidated fixture pages; after restoring internal QA files, reopening the exact prior recording namespace recovered the saved recording. This was preview refresh behavior, not lost recording evidence.
- Production builds exclude fixture.js and matrix.html; QA files are never part of the release.

## Release scope
Only public/capture.js, permission guidance in public/app.js, package version/lockfile, focused capture tests and this record are changed by this patch relative to current GitHub main. Existing unrelated local changes are preserved and not committed wholesale. No database/schema/access/billing changes, production recordings, feedback writes or user-data deletions are part of this run.

Release target is the existing Vercel screennote project, team_0iK5RqUAPfnRJmhOhJHl1xD7, canonical origin https://screennote-woad.vercel.app/. Deploy the exact patch commit; verify /release.json version 0.3.1 and local sourceFingerprint before calling production updated. Deployment identity is captured in the final handoff.

## Verdict
Permission recovery patch: READY for release after the checks above.
Full native/physical-device recorder certification: NOT READY. Actual Chrome/Edge source selection, native decline/retry, real hardware combinations and Android/iOS/Safari acceptance remain open. Previous approved Supabase cloud-sharing acceptance is retained as dated evidence, not falsely described as rerun in this patch.

