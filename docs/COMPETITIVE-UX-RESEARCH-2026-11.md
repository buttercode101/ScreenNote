# ScreenNote Competitive UX Research & Product Direction
**Research date:** 26 November 2026

## Executive summary
ScreenNote should not compete as a feature-checklist clone. The strongest position is a focused, privacy-conscious “show it, mark the moment, send it” workflow with excellent recipient experience and dependable local-first capture. The category has normalized quick capture, browser share links, timestamped comments, transcripts, chapters, editing, and team libraries. ScreenNote's advantage should be coherence: fewer steps, thoughtful defaults, polished playback/annotation, and resilience on real-world connections.

## Competitor patterns verified from current product documentation
### Loom (Atlassian)
- Screen, microphone/audio, camera, 1080p/4K capture, quick setup and sharing.
- Editing, trim/stitch, live rewind, comments, reactions, transcripts, captions, watch-later, and viewer insights.
- Transcript timestamps navigate the player; chapters are transcript-derived and editable.
- Owner controls for video interaction and privacy.
Sources: https://www.loom.com/products/online-screen-recorder ; https://www.loom.com/pricing ; https://support.atlassian.com/loom/docs/loom-video-transcription-and-closed-captions ; https://support.atlassian.com/loom/docs/how-auto-titles-summaries-and-chapters-work

### Zight
- Screen/window/region capture, camera overlay, system audio plus microphone, live annotation, desktop trim/split, GIFs, and share link copied after recording.
- Browser recipients can view without installing the app or creating an account.
- Annotation supports arrows, shapes, text, highlights, blur/redaction, and timed emphasis.
- Video requests make capture bidirectional.
Sources: https://zight.com/features ; https://zight.com/screen-recorder ; https://zight.com/screenshot ; https://support.zight.com/hc/en-us/articles/5818947110807-How-to-annotate-screenshots-annotate-GIFs

### Claap
- Comments attached to recordings can be resolved, searched, and sorted.
- Public links work for recipients outside a workspace; links can open at a timestamp and embed elsewhere.
- Transcript lines are timestamped, searchable, synchronized to playback, and support comments at exact moments.
- In-recording pinning and area annotations are documented.
Sources: https://help.claap.io/en/articles/7127877-video-transcript-in-claap-videos ; https://help.claap.io/en/articles/16600260-what-you-can-do-with-a-claap-meeting ; https://help.claap.io/en/articles/6286747-add-and-manage-comments-on-a-claap-video

## What is working in the category
1. One primary capture action; advanced configuration is progressive.
2. Recipient-first sharing; no account wall for basic viewing.
3. Time-based context: comments, transcript cues, chapters, and timestamp links.
4. Immediate local preview, clear title, quick trim, then share.
5. Durable library with status and clear local-vs-cloud state.
6. Transparent privacy: permission, visibility, expiry, password, and download controls.
7. Accessible, keyboard-operable recording and review controls.

## ScreenNote differentiation and gap hypotheses
These are hypotheses to validate against the actual build, not claims that every feature is absent:
- **Capture continuity:** retain recoverable local recording if upload, tab, or network fails; distinguish saved/uploading/ready states.
- **Annotation ergonomics:** timestamp comments plus optional area pinning; clear active tool, undo, and state preservation during seek.
- **Recipient clarity:** focused viewing page with fast player, title, context, timestamp feedback, and understandable privacy/download controls.
- **Review workflow:** open → comment at moment → reply/resolve → owner sees feedback at a glance.
- **Share completion:** copy-link confirmation, native share where supported, and direct timestamp links.
- **Library utility:** search, sort, filters, status, and complete empty/loading/offline/error states.
- **Brand distinction:** warm paper/ink/clay/sage palette, restrained borders, editorial type hierarchy, purposeful whitespace; avoid neon gradients, generic blue/purple SaaS gradients, and excessive card grids.

## Design system direction
- Light: limestone canvas #F5F3EE, warm near-white surface #FCFBF8, ink #20241F, quiet border #D9D8D0, restrained clay #9E472F, sage as secondary.
- Dark: deep green-black #151815, raised charcoal-green surfaces, soft neutral text, muted clay accent #E2A18B.
- Keep the existing font stack; establish display/body/UI roles, line-height, tracking, responsive type sizes, and a 4px spacing base.
- Use surface hierarchy and typography instead of gradients or decorative color blocks.

## Performance benchmarks
Google's good Core Web Vitals p75 thresholds: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.
Sources: https://web.dev/articles/defining-core-web-vitals-thresholds ; https://web.dev/articles/lcp

### ScreenNote internal acceptance targets (targets, not measured results)
- LCP ≤ 2.0 s target; ≤ 2.5 s p75 on mobile and desktop.
- INP ≤ 150 ms target; ≤ 200 ms p75.
- CLS ≤ 0.05 target; ≤ 0.1 p75.
- Capture starts within 2 s after permissions on supported test hardware.
- Local preview appears immediately after stop; upload never blocks preview/editing.
- Chunked/resumable upload with bounded retries and explicit recovery.
- No silent recording loss: test permission denial, device disconnect, tab interruption, offline transition, failed chunk, retry, and restore.
- Measure player startup and seek-to-frame separately from page metrics.

Browser recording reference: MediaRecorder supports timesliced chunks via start(timeslice) and periodic dataavailable events, enabling incremental persistence/upload rather than one giant in-memory blob. https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder ; https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/start

## Product priorities
### P0 — trust and task completion
- Start recording quickly; permissions and unsupported capabilities explain themselves.
- Reliable local capture and recoverable upload.
- Immediate preview, safe draft, clear publish/share status.
- Recipient playback and timestamped comments on mobile.
- Responsive containment, keyboard focus, touch targets, accessible status messaging.

### P1 — best-in-class async review
- Timestamped comments and replies; resolve feedback.
- Annotation/area pinning with clear active tool and undo.
- Share at timestamp, copy link, native share, optional embed.
- Transcript and chapter navigation when transcription is reliable and affordable.

### P2 — paid-worthy workflow
- Reusable team/workspace library and search.
- Review status, viewer engagement, privacy presets, branded player.
- Integrations after core workflow is measurably excellent.

## Evidence discipline
Competitor feature lists are sourced from official product/help pages and may change. Performance values are acceptance targets, not competitor measurements. Do not claim “10x faster” or “better than Loom” without reproducible matched-device, network, and media-size tests.
