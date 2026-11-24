# ScreenNote

**The temporary screen note that ends when the conversation ends.**

ScreenNote is a web-first tool for short screen explanations and focused async feedback. Record or import a clip, review and trim it locally, then explicitly publish a temporary link. Viewers do not need an account. Timestamped comments, replies and frame-point annotations stay attached to the exact moment. When the share expires or the creator stops sharing, the cloud copy and its discussion are deleted.

## Product principles

- Local-first originals; no cloud upload before an explicit publish action.
- Temporary shared copies, with 1, 3 or 7 day expiry.
- Optional password protection and anonymous viewing.
- Timestamped threaded comments, resolve/reopen and frame-point annotations.
- Playback bubbles and structured coding-agent handoff export.
- Portable recovery keys for creator control.
- Cloudflare Workers, D1 and private R2 storage.
- No permanent cloud video library and no account required for the core flow.

## Rebuild status

The active implementation is in [rebuild/](rebuild/README.md) on branch rebuild/cloudflare-web-first.

- TypeScript checks, unit tests, production build and Playwright browser acceptance are automated in GitHub Actions.
- The D1 schema migrations for temporary shares and frame annotations have been applied to the isolated development database.
- Cloudflare development Worker deployment is not yet complete. The workflow needs a repository Actions secret named CLOUDFLARE_API_TOKEN with scoped Workers Scripts, D1 and R2 edit permissions.
- The existing Vercel deployment is intentionally untouched until the Cloudflare replacement passes deployed integration and production acceptance.

See [rebuild/README.md](rebuild/README.md) for architecture, limits, development instructions and remaining release gates.
