# Security Policy

## Reporting a vulnerability

If you discover a security issue in ScreenNote, please report it
**privately** rather than opening a public issue:

- Email: **security@buttercode101.com**, or
- Open a GitHub private vulnerability report on this repository.

Include steps to reproduce, the impact you believe it has, and any
suggested fix. We acknowledge reports within 48 hours and aim to
resolve confirmed issues promptly. Please do not disclose the issue
publicly until a fix is available.

## What ScreenNote stores, and where

ScreenNote records, shares, and discusses short screen videos with
timestamped feedback.

- **Capture stays on your device until you publish.** Drafts are
  local; nothing is shared until you choose to publish a viewing link.
- **Published videos and comments are stored in object storage
  (Vercel Blob / Supabase) and served via the app's publishing API.**
  A published link should be treated as sharing the video with anyone
  who holds it. Unpublish or delete recordings you no longer want
  public.
- **Client publishing uses server-issued, scoped storage access.**
  Uploads pass server-side validation (file type, size, record paths);
  storage-gateway errors are handled without leaking database
  internals to clients.

## Data handling best practice

- Record only screens you are entitled to share; screen recordings
  often capture credentials, personal messages, and unrelated
  windows.
- Do not publish links publicly if the video contains sensitive
  material, even temporarily.
- Report suspected unauthorized access or storage exposure
  immediately via the channel above.

## Known limitations (not vulnerabilities)

- No automatic transcription or AI analysis is performed; comments
  are human feedback, not moderation.
- Viewing links are bearer capability links: there is no account
  system, so link confidentiality is the access control.
- Deleted or unpublished items may persist in platform backups for a
  limited time per the storage provider's policy.

## Scope

In scope: the web app and publishing API, the Android client, and
the verification workflows in this repository.

Out of scope: third-party storage and hosting platforms (Vercel Blob,
Supabase, GitHub) except as integrated through this app's server.
