# ScreenNote competitive research & product direction
**Research date:** 26 November 2026  
**Scope:** asynchronous screen recording, visual feedback, annotation, playback, editing and sharing.  
**Source policy:** competitor feature claims below are drawn from their public product or help documentation. Product recommendations and performance targets are ScreenNote design decisions, not claims about competitor internals.

## Competitive landscape

### Loom — the familiar async video message
Loom's public Starter plan lists screen-and-camera recording, system audio, comments/reactions, transcripts, and a 5-minute / 25-video limit. Its video settings support creator control over comments, reactions, transcript visibility and downloads.
- Sources: https://www.loom.com/pricing
- https://support.atlassian.com/loom/docs/edit-your-video-settings-disable-comments-emoji-reactions-downloads-and-more

**Pattern to retain:** make capture and link sharing familiar; preserve recipient interaction controls.  
**Opportunity for ScreenNote:** make the core workflow account-free for viewers, local-first for creators, and explicitly temporary rather than pushing users toward a permanent library.

### Claap — feedback tied to a moment
Claap documents timestamped comments, pinning a moment during recording, keyboard shortcuts, and area annotations made by selecting a region of the video. Its recording overlay can be moved and offers pause, restart, stop/save, pin and delete.
- Sources: https://help.claap.io/en/articles/6286747-add-and-manage-comments-on-a-claap-video
- https://help.claap.io/en/articles/6268467-how-to-record-a-video-using-the-claap-chrome-extension
- https://help.claap.io/en/articles/16600260-what-you-can-do-with-a-claap-meeting

**Pattern to retain:** time-anchored discussion, quick capture controls, in-context visual feedback.  
**Opportunity for ScreenNote:** preserve a clear source-frame coordinate system and keep annotations readable on portrait, 4:3 and 16:9 recordings; make review actions understandable without onboarding.

### Tella — creator-quality recording and editing
Tella describes screen/camera recording, multiple clips, video uploads, trimming/cropping, transcript-based editing, subtitles, zoom effects, dynamic layouts, and sharing/analytics.
- Sources: https://www.tella.com/features
- https://www.tella.com/ (product overview)

**Pattern to retain:** recording should lead naturally into review/edit/share; use deliberate preview and editor controls.  
**Opportunity for ScreenNote:** prioritize fast, precise feedback and safe local editing over a large, complex creator suite.

### Zight — broad capture and visual communication
Zight lists screen recording, webcam recording, system audio, annotations, screenshots/GIFs, editing, sharing, request links and bug-report workflows.
- Sources: https://zight.com/features
- https://support.zight.com/hc/en-us/articles/5823722434711-How-To-Annotate-Video-How-to-Draw-On-Video
- https://support.zight.com/hc/en-us/articles/6657856296855-How-do-I-record-my-screen-audio-and-webcam-simultaneously

**Pattern to retain:** annotate with clear tools, and connect the capture to the action it should trigger.  
**Opportunity for ScreenNote:** avoid feature sprawl; make a focused review brief, anchored comments, and a clear close-the-loop status the fastest path.

## Design and interaction principles

1. **One primary action per moment.** Record, review, or publish should each have a clear visual priority. Secondary actions remain discoverable without competing.
2. **Local-first trust.** Explain that original media stays on-device until the creator chooses to publish. Show publish progress and expiry before upload, not after.
3. **Context travels with feedback.** Comments carry time; frame annotations carry normalized coordinates; clicking either seeks to the exact context.
4. **Review state is legible.** Show whether feedback is needed, resolved, or awaiting a response. Make status changes reversible where possible.
5. **No ornamental dashboard.** Prefer a useful library, strong empty state, concise metadata, and clear recovery actions over decorative charts or excessive cards.
6. **Respect media proportions.** Video is rendered at its natural aspect ratio with contained controls; avoid cropping content to force uniform cards.
7. **Accessibility is part of polish.** Keyboard focus, reduced motion, meaningful labels, contrast, and 44px touch targets are acceptance criteria.

## Performance targets

Google's Core Web Vitals "good" thresholds are evaluated at the 75th percentile of page visits:
- **LCP:** <= 2.5 seconds
- **INP:** <= 200 milliseconds
- **CLS:** <= 0.1

Source: https://web.dev/articles/defining-core-web-vitals-thresholds (updated 7 May 2025)

These are the public web baselines, not ScreenNote's stretch goals. ScreenNote should additionally measure and report:
- Cold dashboard load and editor-ready time on a mid-range Android device.
- Time from user gesture to recording UI ready (capture permission remains browser-controlled).
- Time to local persistence after stop; do not wait for upload to finish before preserving the original.
- Upload throughput and resumability on constrained/mobile networks.
- Playback startup, seeking response, and comment-to-frame seek latency.
- Memory use and long-session stability during 10-minute capture.
- UI responsiveness while thumbnail generation, upload, or video decoding is active.

Chrome's screen-capture documentation confirms that `getDisplayMedia()` invokes the browser's user-facing picker and can return selected tab/window/screen video (and audio where supported); browser permission and supported audio tracks are not controllable by ScreenNote.
Source: https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture

## Free-tier and pricing reality (checked 26 November 2026)

| Product | Current public entry point | What the free/entry tier tells us |
|---|---|---|
| Loom | Starter $0; pricing page displays Business $18/user/month and Business + AI $24/user/month (billing selection can change checkout) | Starter lists 25 videos, 5-minute screen recordings, up to 720p, comments/reactions and transcription. Paid plans remove recording/storage limits and add editing. |
| Tella | Pro $13/user/month; Premium $19/user/month (annual billing shown) | Competes on creator-quality editing: 4K export, clip/timeline editing, transcript edits, captions, layouts, zooms and long clips. The official pricing page shows plan/billing choices; treat checkout as authoritative. |
| Zight | Share $0; Create $9.95/user/month billed annually ($12.95 monthly); Collaborate $12/user/month billed annually | Share includes capture/sharing, video requests, screenshots and 15-second GIFs; Create adds unlimited recording/uploads, annotation/editing, transcription and limited AI actions. Scale is custom. |
| Claap | Basic free license; Pro/Business paid | Free users can participate in a workspace with limited recording/upload minutes and core comments/reactions; advanced collaboration/privacy/AI capacity is plan-dependent. |

**Strategic implication:** do not try to win by copying a paid editor's entire feature checklist. ScreenNote's creator value should be local recording/import, precise review, and a polished temporary share workflow with clear lifecycle controls. Keep local creation generous; make cloud retention, storage volume, team administration and advanced workflow capabilities the cost-aware monetization boundary. No competitor prices or limits should be hard-coded into ScreenNote.

Official sources:
- Loom pricing: https://www.loom.com/pricing and https://www.atlassian.com/software/loom/pricing
- Tella feature/pricing overview: https://www.tella.com/features and https://www.tella.com/pricing
- Zight plans: https://zight.com/pricing
- Claap licenses: https://help.claap.io/en/articles/6517952-understanding-claap-plans-licenses-and-pricing

\n**Price snapshot note (26 November 2026):** amounts are USD as shown on official pricing/help pages at research time; billing cadence, region, tax and checkout selection can change the payable amount. These are competitor observations, not ScreenNote pricing recommendations. Tella: https://www.tella.com/pricing · Zight: https://zight.com/pricing and https://support.zight.com/hc/en-us/articles/5825001220631-Plans-Pricing-and-Plan-Changes · Loom: https://www.loom.com/pricing.\n\n## Feature-gap matrix and response

| Workflow | Competitor evidence | ScreenNote response / gap to close |
|---|---|---|
| Capture modes | Loom, Claap, Tella and Zight document screen, camera and/or combined capture. | Keep the browser flow simple; expose mic/system audio/camera as clear toggles, preserve import as an equal first-class path, and communicate browser capability limits before capture. |
| Feedback precision | Claap documents timestamps, pinned moments and area annotations; Loom offers video comments/reactions. | Combine timestamp + normalized frame-point + drawn region, with accurate seek and annotation persistence across trim. |
| Post-capture polish | Tella documents clip workflows, transcript editing, subtitles and zoom effects; Zight documents trim and annotations. | Keep editing lightweight and safe: non-destructive trim, original retained, annotations/captions/chapters in one review workspace. |
| Guest collaboration | Loom/Claap support shared links and video discussion; Claap documents public links without requiring an account. | Account-free guest review is the default; comments and review decisions remain tied to a temporary share and expire with it. |
| Privacy and lifecycle | Competitors provide privacy controls; ScreenNote's documented model is local-first and temporary by design. | Make local-only vs published status unmistakable, show expiry/password before publishing, and verify revoke/expiry deletes media and discussion from D1/R2. |
| Workflow completion | Zight has request links and bug-report flows; Loom has integrations and analytics. | Close the loop with a compact review brief, approve/changes/question decisions, resolve/reopen threads, and exportable Markdown handoff—without turning the app into a heavyweight team suite. |
| Visual quality | Tella emphasizes creator-grade output; major products use familiar video-player conventions. | Avoid feature parity clutter. A quiet editorial interface, reliable responsive video, strong typography and one clear primary action per state should make the product feel considered. |

## ScreenNote performance stretch goals

These are **acceptance targets, not measured results**. Measure with Lighthouse/CrUX and real-device traces; report p75 separately for mobile and desktop.

| Metric | Public good baseline | ScreenNote stretch target |
|---|---:|---:|
| LCP | <= 2.5 s | <= 1.8 s |
| INP | <= 200 ms | <= 150 ms |
| CLS | <= 0.1 | <= 0.05 |
| Comment-to-frame seek | no standard CWV metric | <= 100 ms after click on local/shared playback |
| Local recording persistence | no standard CWV metric | begin chunk persistence during capture; stop should finalize without a full-file re-encode |
| Editor readiness | no universal competitor benchmark published | <= 2.0 s on the defined mid-range Android test device with a representative 1080p clip |
| Upload feedback | no comparable public benchmark found | progress updates at least every 500 ms; never block local save on cloud publish |

Do not claim ScreenNote is faster than a competitor until the same workload, device, browser, network and capture settings have been measured against that competitor.

## ScreenNote's differentiated product promise

**A temporary, private-by-default video review room—not another permanent video library.**

The most defensible product focus:
- Record or import without account friction.
- Keep the original locally; explicitly publish a temporary review copy.
- Share a short, clear link with expiry and optional password.
- Give precise timestamped comments and frame-point annotations.
- Capture a review purpose, focus and expected outcome.
- Resolve feedback and export a structured handoff for a developer or coding agent.
- Make revoke/expire/delete behavior transparent and auditable.

## Visual direction implemented in this branch

**Field Notes:** warm mineral paper, restrained evergreen, quiet sage surfaces, soft graphite text, precise mono metadata, and generous but disciplined spacing. No purple/blue gradients, neon-lime UI, oversized decorative cards, or new font downloads. The current system font stack is retained; typography tokens control scale, line-height and rhythm.

Light and dark modes use the same semantic tokens. Dark mode is warm charcoal/forest rather than pure black; the accent becomes a muted light sage for accessible contrast.

## Remaining proof required before release

- Validate contrast for all semantic states, including disabled, hover, focus, destructive, error and success.
- Test layout and interaction at 320, 360, 390, 768, 1024 and wide desktop widths.
- Test screen and camera capture, import, local persistence, trim, annotations, publish, expiry, revoke, password, anonymous review and comment resolution.
- Verify deployed Cloudflare Worker + D1 + private R2 paths, not just local mocks.
- Measure performance on a real mid-range Android device and a desktop browser; report measured results, not estimated benchmarks.
