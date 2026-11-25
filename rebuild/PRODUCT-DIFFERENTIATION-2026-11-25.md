# ScreenNote product differentiation research

**Research date:** 2026-11-25  
**Target:** Cloudflare-first ScreenNote rebuild  
**Scope:** Product positioning and feature decisions informed by current competitor feature pages and market comparisons. This is research, not proof of customer demand; validate the proposed workflow with real users before pricing it as a paid promise.

## Executive decision

Do not compete as another screen recorder with a longer feature checklist. Screen recording, transcript editing, captions, chapters, AI summaries, zoom effects, sharing, comments, and analytics are already established across the category.

Position ScreenNote as:

> **The private, account-free way to turn a screen recording into a review that someone can act on—and a clean handoff to the person who will fix or approve it.**

The product's core object should become a **Review** rather than a video file. A Review contains the video, a short brief, exact-moment feedback, a decision, a version history, and an exportable action packet. Keep the original local and make publishing explicit.

This is a strategic hypothesis, not a claim that no competitor offers any individual part. The differentiation is the end-to-end experience, privacy defaults, guest access, and a practical handoff designed around solo builders, freelancers, small agencies, QA and support—not another generic video messenger.

## Competitive evidence

### Loom — async communication plus AI automation

Loom's current official materials list auto titles, summaries, chapters, tasks, CTAs, transcript editing, filler/silence removal, AI workflows, bug reports and agent-oriented recording. Its Starter plan is free but limits recordings to 25 videos and 5 minutes each; Business + AI is listed at $24 per user/month.

**Implication:** summaries, chapters, transcript editing and “AI-powered video” are not sufficient differentiation. ScreenNote must win on a more focused workflow and a more user-controlled experience.

Sources:
- https://www.loom.com/pricing
- https://support.atlassian.com/loom/docs/loom-ai-features/

### Tella — polished production and creator editing

Tella promotes screen/camera recording, clip-based recording, transcript editing, automatic subtitles, zooms, layouts, transitions, backgrounds, analytics, sharing, and custom branding. Its listed Pro/Premium pricing is around $13–$19 per user/month billed annually, with plan and credit details varying.

**Implication:** “beautiful recording + good editor” is crowded. Avoid spending the roadmap merely reproducing production effects.

Sources:
- https://www.tella.com/features
- https://www.tella.com/pricing

### Cap — local control and developer/agent workflow

Cap is open source and offers local recording/editing, hosted sharing, custom S3 storage, self-hosting, transcripts, comments, analytics, CLI and MCP access. Its free personal tier includes a full local recorder/editor; paid cloud features are listed around $8.16/month when billed annually.

**Implication:** privacy/local-first alone is not a moat. ScreenNote must make local-first useful in the complete review workflow and be honest about what is uploaded, stored and retained.

Sources:
- https://github.com/CapSoftware/Cap
- https://cap.so/
- https://cap.so/faq

### Bug-report tools — technical context and reproducibility

Current category comparisons distinguish tools that capture console logs, network requests, browser/device details and user actions from general video recorders. Loom helps explain what happened, but technical context is often still collected separately; specialized tools such as Jam and Marker.io focus on developer-ready evidence.

**Implication:** a ScreenNote “repro capsule” is promising, but it must be privacy-safe and genuinely capture reliable context. Do not label manually typed steps or browser metadata as automatic telemetry.

Source:
- https://midge.dev/docs/guides/best-bug-reporting-tools

### Video review tools — frame-accurate feedback and approval

Frame.io, Filestage, Ziflow and related review products already provide timestamped/frame-accurate feedback, markup, review states and version-oriented workflows. Some are expensive for small teams and focus on professional media pipelines.

**Implication:** comments and approval alone are not unique. ScreenNote should make the workflow frictionless for an external guest and connect feedback directly to a practical fix/handoff, without requiring every reviewer to become a workspace member.

Source:
- https://www.upsys-consulting.com/en/blog/best-video-feedback-tools

## Proposed signature workflow: Review → Resolve → Ship

### 1. Review Brief (first implementation priority)

Before publishing, let the owner add a compact brief:
- **Purpose:** what the viewer is looking at.
- **Focus:** one or two things to inspect.
- **Expected outcome:** what “correct” looks like.
- **Requested action:** review, approve, reproduce, or provide feedback.
- Optional due date / audience label.

Display the brief above the player, not buried in a description. Preserve it in the share metadata and include it in the handoff export. A good brief reduces vague feedback and makes the recording useful even if the viewer never watches every second.

### 2. Guest decision workflow

Add explicit reviewer actions:
- **Looks good**
- **Needs changes**
- **Ask a question**

A decision must be attached to a reviewer identity label, timestamp, and current version. A change request should require or strongly encourage a comment anchored to a timestamp/frame. Owners can resolve requests and publish a new version.

Guests must not need an account. Avoid implying verified identity when the reviewer is anonymous; label it clearly as a guest response. Rate-limit and protect the endpoint against spam.

### 3. Repro Capsule (signature technical capability)

For web bug reports, add an optional browser extension (not silent page scripts) that can explicitly capture:
- Current page URL and viewport/browser information.
- User-approved click/keyboard event outline.
- Console errors and failed requests, with sensitive headers, cookies, tokens, query parameters and response bodies excluded by default.
- Optional screenshots/keyframes at user-selected moments.
- A structured, editable reproduction checklist.

The user reviews the capsule locally before publishing. Sensitive fields are scrubbed before upload; the user can remove entries. No background surveillance, no raw credential capture, no automatic upload without a clear consent action.

Export a self-contained Markdown/JSON issue packet with video link, timestamps, steps, expected/actual result, environment, selected logs and reviewer comments. Integrate GitHub Issues first; add Linear only after a reliable OAuth/API implementation and permission review.

**Why this matters:** the deliverable is not just “watch this video”; it is “here is enough evidence to reproduce, triage and fix the problem.”

### 4. Version-aware review

Treat each revision as a version of the same Review:
- Keep prior versions and their status.
- Carry unresolved comments forward by timestamp, with explicit “may have moved” indicators.
- Show resolved/unresolved feedback and a simple version change summary.
- Never silently shift or delete a comment when a trim changes timing.
- Allow owner to mark a version approved or superseded.

### 5. One-click “Preview share” and audience test

After publishing, show:
- **Open share preview** (opens the exact public/guest experience in a new tab).
- **Copy link**
- **View as guest** (test password gate, brief, player, comments and CTA without owner credentials).
- **Manage / stop sharing**

Do not make “copy link” the only success action. A user needs to inspect what the recipient will actually see before sending.

## Roadmap order — implementation, not a feature dump

### P0 — Make the share experience a complete review
1. Review Brief fields and persistence in share details.
2. Public viewer renders brief and requested action clearly.
3. Guest decision endpoint/state with spam controls and anonymous-label honesty.
4. Owner sees decisions, feedback and resolved state in library/editor.
5. Post-publish preview / guest-view action.
6. Tests for password shares, expiry, revoked links, refresh, duplicate submissions, and mobile viewer.

### P1 — Make feedback actionable
1. Version model and safe version publishing.
2. Timestamp/frame anchors for comments and annotations.
3. Issue packet export: Markdown + JSON, captions/chapters, selected comments, report and environment.
4. GitHub issue creation via explicit user-authorized integration; never expose tokens in client bundles.
5. A clean “next action” summary from review status and unresolved comments (deterministic first; optional AI later).

### P2 — Repro Capsule
1. Prototype extension permission model and event capture.
2. Local redaction/preview before upload.
3. Console error capture and failed-request metadata (no secrets/body by default).
4. Stable JSON schema + import/export + regression fixtures.
5. Browser compatibility/security review before wider release.

### P3 — Paid value (after usage validation)
Keep the basic local recorder and guest review useful without an account. Charge only for repeatable team value:
- Team review spaces and shared ownership.
- Longer retention / more hosted storage and bandwidth.
- Branded share pages/custom domain.
- Version history and audit trail.
- Review analytics and workflow integrations.
- Repro Capsule integrations / team triage workflow.

Do not charge merely to remove arbitrary friction from the free local workflow. Do not launch a paid tier until storage, bandwidth, support burden and actual willingness to pay are measured.

## Product principles

- Guest-first: viewers do not need accounts.
- Local-first: originals stay on-device until the owner explicitly publishes.
- Private by default: temporary links, clear expiry, stop-share control, and no public indexing.
- Human review: AI is optional, explainable and never silently uploads sensitive material.
- Honest capability labels: browser-only recording must not pretend it captured DOM, console or network details it cannot access.
- Actionable output: every review should end with a decision, a question, a reproducible issue, or an explicit no-action outcome.
- Reliable over impressive: ship small, complete workflows with real backend state and tests; do not add decorative AI features or fake analytics.

## Success metrics to instrument (privacy-respecting, opt-in where appropriate)

- Record-to-first-preview completion.
- Publish success and retry rate.
- Share opened → feedback/decision conversion.
- Time from first feedback to owner resolution.
- Percentage of reviews with a clear brief.
- Version reshare rate and unresolved-comment carryover correctness.
- Guest completion without account creation.
- Repro packet usefulness measured by developer feedback, not by counting generated files.

## Release acceptance for the signature workflow

A release is not accepted until a fresh guest can open a share without an account, understand the brief, watch and seek, leave timestamped feedback, choose a review decision, refresh without losing it, and the owner can see the decision, resolve it, publish a revised version, and export an accurate issue packet. Test password-protected, expired and revoked links; 320px mobile; keyboard-only; both themes; concurrent reviewer submissions; and failed/offline states.

This document is the product direction and acceptance definition. It does not claim these proposed features have already been implemented or deployed.
