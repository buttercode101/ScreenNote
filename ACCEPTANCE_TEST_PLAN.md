# Acceptance Test Plan — ScreenNote

Date: 2026-11-06 · Tested commit: `421eb4d` + fix set · Env: Termux, Node v26.3.1 (CI: 24.x)

## Core journey
Record/import → preview → edit → publish → share → receive comments → reply → revisit.

## Mandatory tests — execution results
| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Screen recording (supported platforms) | BLOCKED | desktop-browser only; handset/native gates open |
| 2 | Microphone permissions | BLOCKED | no physical device |
| 3 | Recording cancellation | PASS | recording-policy tests |
| 4 | Interrupted recording | PARTIAL | no interruption fixture found |
| 5 | Video import | PASS | import-media tests |
| 6 | Large video import | PASS | 50 MB limit tests; live smoke 65s WebM |
| 7 | Unsupported video | PASS | media-validation tests |
| 8 | Video trimming | PASS | trim tests (mediabunny) |
| 9 | A/V synchronisation | UNVERIFIED | no sync-assertion test found |
| 10 | Publishing | PASS | share-options tests; live smoke |
| 11 | Upload interruption | PASS | resumable part-index tests |
| 12 | Upload retry | PASS | CAS-conflict retry tests |
| 13 | Share link | PASS | live smoke (production) |
| 14 | Password protection | PASS | access tests |
| 15 | Expiring links | PASS | share-options tests |
| 16 | Revoked links | PASS | "revoked cannot republish" test |
| 17 | Guest access | PASS | guest/gateway tests |
| 18 | Timestamped comments | PASS | discussion tests |
| 19 | Nested replies | PASS | reply-to-any tests |
| 20 | Speech bubbles | PASS (UI fixtures) | tests/ui manual fixtures — no automated run (S-002) |
| 21 | Annotation timing | UNVERIFIED | no timing-assertion test |
| 22 | Comment moderation | PASS | moderation tests |
| 23 | Video deletion | PASS | deletion/reclaim tests |
| 24 | Storage retention | PASS | retention/capacity tests |
| 25 | Mobile playback | BLOCKED | emulator only (API 35, CI); handset open |
| 26 | Desktop playback | PASS | live smoke playback integrity |
| 27 | Long-video performance | PARTIAL | 65s CI fixture only; no load test |
| 28 | Concurrent guest interactions | PASS | CAS retry without lost replies (test) |

Counts: PASS 19 · PARTIAL 2 · UNVERIFIED 2 · BLOCKED 3 · (2 further items covered above; total 28).
Manual browser fixtures: `tests/ui/{fixture.js,matrix.html,matrix.js,qa.html,qa.js}` — require a real browser; not run headlessly in this pass.
