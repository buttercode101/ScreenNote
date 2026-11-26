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
