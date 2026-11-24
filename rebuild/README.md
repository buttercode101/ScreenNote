# ScreenNote rebuild

This is the new Cloudflare-first implementation. The legacy application remains at the repository root during the migration and is not modified by this first foundation commit.

## Product principles

- Guest-first. No account is required to begin.
- Local-first capture and review. Cloud upload happens only after an explicit user action.
- Private by default. Publishing and viewer access are separate, explicit product steps.
- Progressive enhancement. Browser capture is feature-detected; import remains available where native capture is unavailable.
- No unlimited promises. Upload, storage, processing and delivery limits are visible and measured.

## Current implementation slice

- Responsive React application shell with light and dark themes.
- Screen capture using the browser's native source picker.
- Optional microphone and system audio when the browser exposes them.
- Pause, resume and finish controls.
- Local IndexedDB library and MP4/WebM/MOV import.
- Cloudflare Worker API foundation for guest sessions and private R2 uploads.
- D1 schema for guest sessions and recording metadata.

## Cloudflare development resources

The initial isolated development resources have been provisioned:

- D1: `screennote-dev`
- R2: `screennote-media-dev`

No existing Cloudflare application resources were reused or modified.

## Important current limitations

This is a foundation slice, not a launch-ready release. The UI currently stores recordings locally. The upload API exists as a backend foundation but is not yet wired into the UI. Shared playback, public share tokens, comments, transcription, AI summaries, camera composition, desktop recording and production billing are not implemented in this slice.

## Next engineering gates

1. Add Cloudflare project configuration and migration execution.
2. Run typecheck, build, unit tests and Worker-runtime tests.
3. Connect local library upload and cloud playback.
4. Implement share-link lifecycle, revocation, expiry and access controls.
5. Add camera bubble composition and recording recovery.
6. Complete accessibility, responsive and real-browser/device acceptance.
7. Deploy to a dedicated development hostname before any production cutover.