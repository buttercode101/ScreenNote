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


## Extended competitor landscape — checked 26 November 2026
### Tella
Tella is the strongest creator/editor reference in this set: separate screen and camera tracks, multiple takes/clips, transcript-based editing, automatic captions, silence/filler removal, zooms, layouts, auto-upload, 4K export, hosted share pages, analytics, and team workspace. Its published pricing/feature pages indicate paid tiers and credit-metered AI workflows.
Sources: https://www.tella.com/features ; https://www.tella.com/recorder ; https://www.tella.com/pricing

### ScreenPal
ScreenPal combines screen/webcam recording, an editor, screenshot capture and annotation, online video hosting, and a growing set of AI-assisted transcript, caption, chapter, text-based editing, quiz, and audio-description tools.
Source: https://screenpal.com/features

### Vidyard
Vidyard's strength is business communication: screen/webcam capture through extension/desktop/mobile, branded video landing pages, view notifications, responsive hosted playback, playlists, chapters, captions/transcription, upload widgets, and analytics.
Source: https://www.vidyard.com/products/features/

## Qualitative friction signals (use as hypotheses, not prevalence claims)
- Public browser-extension reviews include reports of camera/microphone detection failures, disabled start controls, and unreliable capture. A November 2026 review aggregation is anecdotal and not a representative usability study.
  Source: https://chrome-stats.com/d/liecbddmkiiihnedobmlmillhodjkdmb/reviews
- A December 2025 Reddit thread describes a user unable to start or select devices in Loom and Claap extensions. This is a single-user report, not proof of a general defect.
  Source: https://www.reddit.com/r/chrome/comments/1pnaylv/unable_to_record_screen_with_extensions/
- A 2025 qualitative study found setup burden, privacy concerns about notifications appearing in captures, and upload delays causing repeat attempts for some participants.
  Source: https://doi.org/10.1017/S1368980025000515
- A usability evaluation of recording controls noted confusion between record affordances, desired countdown/confirmation, and need for clear upload-completion feedback. This is older foundational evidence, not a current competitor score.
  Source: https://www.project-easier.eu/wp-content/uploads/sites/67/2024/02/EASIER_D1.4_Report-on-final-evaluation-study.pdf

## ScreenNote verified capability baseline (26 Nov 2026)
The current build is an early-access, local-first beta with: desktop browser screen capture; microphone/camera and optional shared-screen audio; countdown and pause/resume; local recovery and download; import on mobile; local trim/compress and fixed mask/mark copy; manually supplied captions and chapters; local searchable library; unlisted sharing; expiry options; optional password protection; revoke; timestamped comments/replies, reactions, and review status. Current help copy sets local recording/import limits at 30 min / 250 MB, shared video at 10 min / 50 MB, and shared storage budget at 1 GB. Basic viewers do not need an account.

## Gap matrix and recommended position
| Capability | ScreenNote today | Leading competitor expectation | Recommended next step |
|---|---|---|---|
| Capture | Browser desktop; mobile import | Native desktop/mobile, source selection, system audio | Keep permission/device diagnostics first-class; native capture only where justified |
| Recovery | Local-first, recovery export, resumable part upload | Upload while recording, autosave, recoverable drafts | Make saved/uploading/recoverable states unmistakable; test interruption paths |
| Editing | Local trim/compress, masks/marks | Multi-take, separate tracks, transcript editing, zoom/layout effects | Prioritize fast trim, timestamp annotation and undo before complex timeline |
| Accessibility | User-provided captions/chapters | Auto transcripts, captions, chapters | Add accessible transcript/caption workflow; auto-transcription only with sustainable cost and quality |
| Review | Timestamp comments/replies, reactions, status | Resolve threads, transcript comments, viewer analytics | Improve timestamp pinning, resolve/reopen, share-at-time |
| Sharing | No-account viewer, password, expiry, revoke | Embed, branding, CTA, custom domains, analytics | Recipient page clarity and safe sharing before branding upsell |
| Workspace | Device-local library | Team workspace, search, shared library, integrations | Validate collaboration demand before adding accounts/teams |
| Monetization | Early-access beta; no payment enabled | Free and paid tiers with feature limits | Do not gate core reliability; validate willingness to pay before implementing plans |

## Research-derived product strategy
ScreenNote's credible differentiation is not “more AI” or “more effects.” It is **privacy-first, no-account viewing, local-first recoverability, and feedback anchored to the exact moment**. Compete on the trust and completion of the record → review → share → respond loop. Avoid feature parity with Tella's full creator editor until ScreenNote's capture, recovery, recipient page, and annotation are measurably excellent.

## ScreenNote production verification — 26 Nov 2026
- Unit/integration suite: 120 passed, 0 failed.
- Build: passed.
- Responsive browser pass: 320, 375, 390, 768, 1024, 1440 px; no document overflow, no JS errors, no failed network requests on the main view.
- Mobile import/download flow: passed.
- Sample import, title save, local trim-copy, library search: passed.
- Production live-smoke: both unprotected and password-protected test videos published, playback hashes verified, and test records cleaned up.
- Mobile Lighthouse lab run after contrast correction: Performance 93, Accessibility 100, Best Practices 100; FCP 0.8 s, LCP 1.6 s, TBT 330 ms, CLS 0.
- Production dependency audit: 0 vulnerabilities with dev dependencies omitted. Full npm audit: 0 vulnerabilities after moving c8/esbuild to devDependencies and updating c8 to 9.1.0.

These are observed results from this test pass, not guarantees across every device/network/browser.

- Browser capture E2E: fake screen source, begin, pause, resume, stop, local save and playback passed; 6.46-second media sample.
- Annotation E2E: draw one mark and save marked copy passed; original retained; no console errors after preview cleanup fix.
- Permission-denied E2E: clear decline message, no upload, recording inactive.


## Local code-split build verification — 26 Nov 2026
The local production build now splits capture, annotation, import, and editor/collaboration modules into ESM chunks and loads them only when their workflows are used. The initial `dist/app.js` entry is 75 KB uncompressed versus the previous 129 KB bundled entry (about 42% smaller); lazy chunks total about 84 KB and are not all requested on the home screen.
- Local Lighthouse lab (localhost static production build, Chromium mobile emulation): Performance 94, Accessibility 100, Best Practices 100, LCP 2.0 s, TBT 260 ms, CLS 0. Localhost has no CDN/edge path; this is not a production network measurement.
- Local browser E2E against the split build: sample/import/title, trim-copy, annotation-copy, record/pause/resume/stop/playback, permission-denied, mobile import/download, library search, dark mode and 320–1440 px responsive checks passed.
- Media URL cleanup: preview URLs are released after detach; local download uses its own URL so a download does not depend on the preview element's lifetime.
- Production deployment of this code split is pending Vercel deployment API quota reset or an authenticated deployment path. Current live production remains the last successful deployment; do not interpret local Lighthouse numbers as live production results.


## Media lifecycle regression fix — 26 Nov 2026
A final production trim test exposed blob URL `ERR_FILE_NOT_FOUND` console errors from temporary metadata/trim video elements revoking their source before media teardown completed. The metadata preview and trim helper now pause, detach the source, call `load()`, and defer URL revocation for 60 seconds; Node timers are unreferenced so test processes do not wait on cleanup timers. The editor also detaches previews before replacing them, and local download uses a separate object URL. After the fix, local trim + annotation E2E remained successful through a 15-second follow-up with zero console errors (only expected aborted requests when elements are replaced).

- GitHub verification for media lifecycle fix commit `bb6f7fadd60b7da69e905b876d2422c2ff7e81c3`: ScreenNote CI and Verify ScreenNote both completed successfully; Android internal build was still running at the last status check.
