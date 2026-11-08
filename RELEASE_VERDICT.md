# ScreenNote Release Verdict — 0.5.0 Free Beta

**Branch:** flagship-excellence (524ff1b) · **Commit:** 524ff1b · **Date:** 2026-11-08 · **Live:** https://screennote-woad.vercel.app

## Final verdict

**CONDITIONALLY READY** for release as a constrained free beta — desktop-browser & import/share/comment loop verified working. **NOT READY** for handset-capture claims until physical-device acceptance passes.

## What is verified working (live smoke on production)

| Category | Status | Evidence |
|---|---|---|
| `npm test` | ✅ 120/120 pass | `tests/*.test.js` suite (metadata, capture, discussion, capacity, media-validation, storage gateway, protected/revoked videos, share settings) |
| `npm run build` | ✅ Clean | No QA leak; fixture guard passes |
| Health check | ✅ `configured:true` | `/api/clip?op=health` → 50 MB/600s/1 GB budget |
| Share link flow | ✅ End-to-end | Publish → copy link → viewer → comments/replies → resolve/reopen |
| Import from device | ✅ End-to-end | MP4/WebM import → library → review → share |
| Recovery-key JSON | ✅ Management restore | Restores capability keys, not video files (documented) |
| Permission wait/cancel/timeout | ✅ Verified | 60 s deadline, late-grant release, `NotAllowedError` handling |
| Emergency download on storage failure | ✅ Verified | Banner persists across navigation |
| Offline banner + publish gate | ✅ Verified | Publish disabled offline with reason |
| Upload resume + per-part retry | ✅ Verified | Chunked upload with retry ×3 |
| Clipboard fallback dialog | ✅ Verified | Copy link → fallback input dialog |
| Comment draft across refresh | ✅ Verified | `sessionStorage` per tab survives refresh |
| Deep-link seek/focus | ✅ Verified | `#comment=<id>` seeks + expands + focuses |
| Intrinsic-ratio portrait playback | ✅ Verified | Fixed 2026-10-26 (`verification/mobile-media-fixes-2026-10-26.md`) |
| Dialog mutation lock + focus restore | ✅ Verified | `<dialog>` blocks Cancel/Escape during mutation |
| 44 px targets + visible focus | ✅ Verified | CSS-shipped; skip link, aria-live notices |
| CSP + `frame-ancestors 'none'` | ✅ Verified | Live at `screennote-woad.vercel.app` |

## What is NOT verified (conditions required)

| Category | Blocked item | Required action | Reference |
|---|---|---|---|
| Physical device | Android handset recording/playback | Physical-device pass per `LAUNCH-READINESS.md:27–33` | BLOCKED — no handset access |
| | iOS Safari import/playback | Same as above | BLOCKED |
| | Android native cap disclosure | Android 5 min/25 MiB vs web 30 min/250 MB | UX-19 |
| Responsive | 11-viewport matrix headless re-run | Last run was v0.1.3; not verified at 0.5.0 | `RESPONSIVE_COMPATIBILITY_REPORT.md` |
| User validation | 5–10 user interviews + small-cohort protocol | `LAUNCH-READINESS.md:55–59` not run | Owed |
| Deployment | Byte-equality `release.json` | Observed fingerprint; byte equality unproven | `RELEASE_ACCEPTANCE_REPORT:14` |

## Verdict text

> ScreenNote 0.5.0 is released as a **constrained free beta**.  
> All desktop-browser recording, import, review, trim, publish, share, and comment-loop workflows are verified working (120/120 tests pass, build clean, live smoke on production).  
> **Handset capture (Android native recorder, iOS Safari) is not verified.** No "mobile-verified" claim should be marketed until a physical-device acceptance pass exists per `LAUNCH-READINESS.md:27–33` and `RESPONSIVE_COMPATIBILITY_REPORT.md`.  
> The product correctly labels itself "free beta" with explicit constraints (10 min/50 MB shared, 1 GB budget, unverified names, no accounts). No paid tier, no subscriptions, no account required.  
> **Do not market handset capture as verified until the physical-device pass completes.**

## Post-release outstanding items (track separately)

- Physical Android/iOS pass (BLOCKED — owner device access)
- Automate `tests/ui/matrix` (Playwright) + 11-viewport run
- Spend alert on 1 GB Supabase budget (owner account action)
- S-006 branch cleanup (owner confirmation)
- IL: guest-enumeration IDOR test + magic-byte upload check (recommended P2 hardening)

---

*Release verdict generated 2026-11-08 on branch flagship-excellence (524ff1b). All claims source-evidenced from in-repo docs, source code, and live API checks.*