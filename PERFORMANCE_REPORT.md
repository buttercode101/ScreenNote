# Performance Report — ScreenNote

Date: 2026-11-06 · Env: Termux, Node v26.3.1 (repo/CI: 24.x).

## Observed
- Live `https://screennote-woad.vercel.app/`: HTTP 200 in 0.86s (single curl, warm edge).
- `/api/clip?op=health`: 112.7 MB reserved of 1 GB budget; 887 MB available — headroom healthy.
- `npm test` runtime: 10.4s (112 tests). `npm run build` (esbuild) completes; `dist/` ships clean (no QA fixtures).
- CI live fixture: 65s / ~33 MB WebM upload→playback cycle passes within 20-min job timeout.

## Targets (not yet measured)
- Lighthouse Performance 90+ / Accessibility 95+ / Best Practices 95+ / SEO 90+; INP ≤200ms; LCP ≤2.5s; CLS ≤0.1. No Lighthouse run in this pass — no scores claimed.
- Long-video (10 min / 50 MB) transfer performance: PARTIAL (65s fixture only); no load/egress test.

## Notes
- Chunks upload in parallel parts with resumable indexes; assembly reserves 2× transient capacity — capacity behaviour is tested, bandwidth cost is not capped (see DEFECT_REGISTER.md accepted risks).
