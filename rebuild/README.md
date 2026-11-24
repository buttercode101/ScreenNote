# ScreenNote rebuild

This is the new Cloudflare-first implementation. The legacy application remains at the repository root during the migration and is not modified by this foundation slice.

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
- Optional circular camera bubble composited into the recorded screen video, with mixed microphone/system audio.
- Pause, resume and finish controls.
- Local IndexedDB library and MP4/WebM/MOV import.
- Chunk-by-chunk recording persistence with interrupted-session recovery.
- PWA service worker with offline shell and static asset caching.
- Cloudflare Worker API foundation for guest sessions, private media uploads and cached static asset delivery from R2 when no native Assets binding is present.
- D1 schema for guest sessions and recording metadata.
- Typed Cloudflare project configuration, Vite integration and observability settings.

## Isolated Cloudflare development resources

- D1: `screennote-dev` (ENAM primary region)
- R2: `screennote-media-dev` (ENAM bucket location)
- R2: `screennote-static-dev` (ENAM bucket location, versioned static build assets)

These resources were created specifically for this rebuild. Existing Cloudflare projects and buckets were not reused or modified.

## Important current limitations

This is a foundation slice, not a launch-ready release. The UI currently stores recordings locally. The upload API exists as a backend foundation but is not yet wired into the UI. Shared playback, public share tokens, comments, transcription, AI summaries, camera composition, desktop recording and production billing are not implemented in this slice.

## Development

Requires Node.js 22.18+ and the Cloudflare CLI `cf`.

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

Deploy only to the dedicated development Worker after the D1 migration is applied:

```bash
npm run deploy
```

## Desktop companion direction

The desktop application will reuse the web UI through a proposed Tauri 2 shell and platform-native capture adapters. See `desktop/README.md` for the OS-specific capture architecture and release gates. The desktop client is not implemented in this web-first slice.

## Next engineering gates

1. Apply and verify the D1 migration in the development database.
2. Run typecheck, build, unit tests and Worker-runtime tests.
3. Connect local library upload and cloud playback.
4. Implement share-link lifecycle, revocation, expiry and access controls.
5. Add camera bubble composition and recording recovery.
6. Complete accessibility, responsive and real-browser/device acceptance.
7. Deploy to a dedicated development hostname before any production cutover.