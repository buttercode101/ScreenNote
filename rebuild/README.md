# ScreenNote — Cloudflare rebuild

**The temporary screen note that ends when the conversation ends.**

ScreenNote is a short-form async collaboration tool. Record or import a video, review the original locally, and explicitly publish a temporary copy. Viewers need no account. Timestamped threaded comments stay attached to the video. When the owner stops sharing or the expiry passes, the shared video and its discussion are deleted.

## Product guarantees

- The original recording remains in the user's local browser storage unless they explicitly delete or export it.
- Cloud upload happens only after the user chooses **Publish temporary link**.
- Shared links expire after 1, 3 or 7 days and may be password-protected.
- Viewer access is anonymous; no account or login is required.
- The share token, owner key, viewer access token and comment author keys are stored as hashes server-side.
- Video delivery is private, non-cacheable and supports byte ranges for seeking.
- Stopping a share deletes its R2 media object and cascades the share and comment records.
- A scheduled cleanup runs every 15 minutes to delete expired shares and abandoned upload reservations.
- Recovery keys are exported separately from the share URL. They allow the creator to manage the share from another browser.

## Current implementation

- Responsive React workspace with light/dark appearance.
- Browser screen capture, optional microphone/system audio and camera bubble composition.
- Pause/resume, finish, local chunk persistence and interrupted-recording recovery.
- MP4/WebM/MOV local import, metadata inspection, playback, local trimming to a new WebM copy and download.
- IndexedDB local library; no cloud upload until explicit publication.
- Guest sessions, D1 metadata, R2 private media upload and deletion.
- Expiring share links, optional password gate and anonymous viewer.
- Timestamped comments, nested replies, frame-point annotations, comment editing/deletion, creator resolve/reopen and in-player playback bubbles.
- Structured recursive discussion export for coding-agent handoff, plus separate video download and private recovery-key export/import.
- Playback bubbles that surface active comment threads at their timestamps.
- Portable private recovery-key export/import.
- Worker health, observability and scheduled retention cleanup.

## Limits

- Maximum shared upload: 100 MB.
- Maximum shared duration: 10 minutes.
- Supported share expiry: 1, 3 or 7 days.
- Optional password length: 8–128 characters.
- Maximum 200 comments per share, 2,000 characters per comment.
- Browser capture requires HTTPS and a compatible desktop browser. Mobile browsers can import existing videos where screen capture is unavailable.
- Local recording storage is browser/device storage, not a cloud backup. Export the original if you need a durable copy.
- Playback bubbles are rendered in the page player and may not appear in native fullscreen or picture-in-picture.
- Frame-level annotations, transcript/AI processing, structured agent export and native desktop capture remain subsequent product milestones.

## Cloudflare development resources

- Worker: `screennote-dev`
- D1: `screennote-dev` (database ID `44a5859b-6411-4513-bd17-3302fbbc0575`, ENAM)
- R2 media: `screennote-media-dev`
- R2 static assets: `screennote-static-dev`

These are isolated development resources. Existing production projects and unrelated buckets are not reused.

## Development

Requires Node.js 22.18+ and the Cloudflare `cf` CLI.

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run e2e
```

For GitHub Actions deployment, configure a repository secret named `CLOUDFLARE_API_TOKEN` with narrowly scoped Workers Scripts, D1 and R2 edit permissions, then run **ScreenNote Cloudflare rebuild** on `rebuild/cloudflare-web-first`. The target development URL is `https://screennote-dev.buttercoder-dev.workers.dev` once the Worker is deployed and verified.

## Acceptance gates still required

1. Successful CI typecheck, unit tests, production build and Playwright suite.
2. Deployed Worker binding verification against the isolated D1/R2 resources.
3. Real browser capture tests with permission denial, device changes, pause/resume and interrupted recording.
4. Full share lifecycle test against deployed R2 and D1, including password lockout, seeking, replies, recovery, revocation and expiry cleanup.
5. Mobile/desktop visual QA, accessibility and keyboard/touch acceptance.
6. Independent security review and a final production cutover decision.

The development branch is not a production release until these gates are complete.
