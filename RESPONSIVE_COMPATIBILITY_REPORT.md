# Responsive Compatibility Report — ScreenNote

Date: 2026-11-06 · Env: Termux + CI (Android emulator API 35, x86_64, pixel_6 profile).

## Verified
- CI `android.yml`: emulator acceptance (API 35 / pixel_6) green at HEAD (run 41991879663, 2026-11-05).
- `live-sharing.yml`: production smoke on real WebM passes (upload→playback→revoke/delete).
- UI fixtures `tests/ui/matrix.html` + `matrix.js` exist for manual viewport matrix (not automated).

## Not verified (BLOCKED / NOT VERIFIED)
- 11-viewport desktop matrix (320×720 → 1920×1080), portrait/landscape, zoom/large-text: NOT VERIFIED headlessly in this pass.
- Physical handset tests (touch, mic/camera permissions, backgrounding, network switching): BLOCKED — emulator is not a handset (§5.5); LAUNCH-READINESS Phase 2 gates remain open.
- iOS Safari / Samsung Internet / Edge / macOS Safari: NOT VERIFIED.

## Recommendation
Automate the matrix fixture (Playwright) + one physical Android pass before any "mobile-verified" claim. Do not claim handset capture works from emulator evidence.
