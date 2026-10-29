![CI](https://github.com/buttercode101/ScreenNote/actions/workflows/verify.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-96%25-brightgreen)

# ScreenNote

**Show what you mean. Share a short video. Keep the conversation at the right moment.**

ScreenNote lets you record or import a short explanation, review it privately, and choose when to publish a viewing link. Viewers can leave timestamped comments and reply to any reply, including their own. Optional playback bubbles bring a conversation back into view at its moment in the video.

[Open ScreenNote](https://screennote-woad.vercel.app) · [Get started](#your-first-screennote) · [Development](#quick-start) · [Technical notes](docs/TECHNICAL-NOTES.md) · [Verification](REPOSITORY-VERIFICATION.md)

## Your first ScreenNote

1. Record your screen in a compatible desktop browser, or import an MP4/WebM from your device.
2. Review playback, name the clip and optionally trim a new copy. The original stays available locally.
3. Explicitly publish a link with a 1, 3 or 7 day expiry and optional password.
4. Let a recipient watch, react and discuss a specific moment. Reply, resolve a thread or reopen it through a reply.
5. Export the video and your private owner recovery keys. Stop sharing or delete the published clip when finished.

## Useful for

| Task | How ScreenNote helps |
| --- | --- |
| Explain a confusing screen | Show the steps instead of writing a long message |
| Report a bug | Show the failure and discuss its exact timestamp |
| Review a design | Keep feedback and follow-up replies together |
| Hand over work | Leave a short walkthrough that the recipient can watch later |

## What is included

- Local recording library, MP4/WebM import, download and real local trim.
- Optional microphone, system audio and camera bubble where the browser supports capture.
- Explicit publishing, expiring links, password protection and creator controls.
- Timestamped threads, reply-to-any-reply, comment editing/removal in the author's original browser, creator moderation and open/resolved filtering.
- Optional playback bubbles, timeline markers, comment links and drafts retained across refreshes.
- Owner-supplied captions, transcripts and bug reports; automatic transcription is not included.

## Limits that matter

Clips are limited to ten minutes and 50 MB. Shared storage uses a 1,000,000,000-byte budget with temporary upload reservations; there is no fixed 16-slot cap. Available clip count depends on sizes, active reservations and provider quotas. Each clip allows up to 100 comments. Names are unverified; owner and author controls depend on private browser capabilities.

Local recordings are browser data, not a backup. Recovery-key files restore management capabilities, not video files. Issued media URLs may continue working for ten minutes after sharing stops. Playback bubbles do not appear in native fullscreen or picture-in-picture. Phones without browser screen capture can import a device recording.

## Quick start

Use Node.js 24 and npm:

```bash
npm ci
npm test
npm run build
python3 -m http.server 3000 --directory dist
```

Open http://localhost:3000. This static preview supports local media workflows; it does **not** run the publishing API. Complete publishing requires Vercel Node Functions and the existing private storage gateway. Server configuration and migration instructions are retained in [technical notes](docs/TECHNICAL-NOTES.md#development). Production capture requires HTTPS and compatible browser permissions.

## Project guide

- [Fresh repository checks](REPOSITORY-VERIFICATION.md)
- [Conversation design and acceptance](verification/conversations-2026-10-26.md)
- [Storage-capacity evidence](verification/storage-capacity-2026-10-26.md)
- [Launch and physical-device gates](LAUNCH-READINESS.md)
- [Architecture and historical releases](docs/TECHNICAL-NOTES.md)
- [Contributing](CONTRIBUTING.md) · [Security reporting](SECURITY.md)

Current source version: **0.4.0**. The old Blob suspension is historical; it does not mean historical media was migrated. Physical handsets and native capture permissions remain separate acceptance gates.
