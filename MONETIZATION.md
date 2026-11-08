# ScreenNote Monetization — Free Beta → Sustainable Model Assessment

**Status:** Free beta (0.5.0). No accounts, no subscriptions, no payments enabled. This document assesses path to sustainability without inventing demand.

## 1. Current model [EVIDENCE]

- **Free beta** — `LAUNCH-READINESS.md:45`: "No card, account, subscription or paid upgrade is enabled."
- **No paid tier exists** — `COMPETITIVE_BENCHMARK.md:21`: "ScreenNote: ✅ Everything (beta) — No paid tier exists."
- **Ceiling = 1 GB shared budget + 10 min / 50 MB per clip** — `PRODUCT_IDENTITY.md:62`; live health check `maxSeconds:600,maxBytes:50000000`
- **Creator control = capability keys + recovery-key JSON** — `PRODUCT_IDENTITY.md:56`; no workspace seats, no accounts
- **No analytics, no AI transcription, no enterprise features** — `PRODUCT_IDENTITY.md:58`; `COMPETITIVE_BENCHMARK.md:58–77`

## 2. What can not be charged for [EVIDENCE]

| Feature | Reason |
|---|---|
| Screen recording (desktop browser) | Core capability; no value-add to charge |
| Import from device MP4/WebM | Documented fallback; no fair-charge path |
| Timestamped threads + reply-to-any-reply | Core differentiator vs Loom/Tella/Bubbles |
| 1/3/7-day expiry + password protection | Explicitly part of the free beta promise |
| Recovery-key JSON restores management | Not video file restoration (§ PRODUCT_IDENTITY.md:56) |
| Local IndexedDB library | Client-side only; no server cost per user |
| No-account viewing/commenting | Core access model; P4 (no accounts, no polling) |

## 3. Sustainable-model hypotheses [HYPOTHESIS — validate, don't publish]

- **H-A:** The winnable wedge is *private, expiring, no-account feedback* for individuals/freelancers who find Loom/Tella workspaces heavy and Frame.io too production-oriented. Test via landing-page message + 5 user interviews. **Do not build a paid tier until interviews confirm willingness to pay for expiry-control + privacy.**
- **H-B:** Monetization, when needed, should price *storage/egress + expiry control*, not seats — ScreenNote's 1 GB shared budget maps cleanly to a "shared-clip credits" model (cf. Tella credits). **Do not charge per seat — that imports the workspace complexity ScreenNote avoids.**
- **H-C:** Android native + import fallback is sufficient for beta; iOS native capture (ReplayKit) is the only mobile investment that changes competitive parity. **Defer paid-model investment until physical-device acceptance passes.**
- **H-D:** Frame.io/Vimeo Review are complements for pro review, not substitutes for capture. **Competing there would dilute the async-explainer wedge; keep scope narrow.**

## 4. What should not be done [ABSOLUTE — no invented demand]

- ❌ Do not create a "Pro" or "Business" tier with seat pricing — that contradicts P4 (no accounts, no seats)
- ❌ Do not charge for "unlimited clips" — the 1 GB / 10 min / 50 MB caps are the ceiling; exceeding them requires platform quota assessment, not a product tier
- ❌ Do not charge for AI transcription/editing — it is explicitly not included (PRODUCT_IDENTITY.md:58); adding it would require a fundamental product pivot
- ❌ Do not imply "free forever" as a commercial claim — label it "constrained free beta" per LAUNCH-READINESS.md:11,43–44
- ❌ Do not invent demand (e.g. "users will pay for collaboration features" without interview data). The competitive data shows many $0 free tiers exist (Loom Starter, Bubbles Free, Frame.io Free); price alone is not a moat.

## 5. Path to sustainability (if/when required)

| Step | Evidence | Action |
|---|---|---|
| 1 | 5–10 user interviews per `LAUNCH-READINESS.md:55–59` | Validate H-A willingness to pay for expiry + privacy |
| 2 | Real cohort transfer data per `LAUNCH-READINESS.md:49–53` | Measure egress/cost per active user before any pricing |
| 3 | If H-A & H-B positive: design a "shared-clip credits" model pricing storage/egress + expiry control | Keep per-clip, not per-seat; align with 1 GB / 10 min / 50 MB ceiling |
| 4 | Update `LAUNCH-READINESS.md` and `MONETIZATION.md` | Document the new model; retain "free beta" label until paid tier is live |
| 5 | If negative: continue as constrained free beta indefinitely | No paid tier shipped = no commercial claim |

**Bottom line:** ScreenNote 0.5.0 is a constrained free beta. No paid tier, no accounts, no subscriptions. Any future monetization must be grounded in validated user willingness to pay for expiry/privacy control — not invented demand or seat-based pricing that conflicts with the no-account design.

*Document generated 2026-11-08 as part of ScreenNote flagship-excellence final phase. No hypotheses are published as fact.*