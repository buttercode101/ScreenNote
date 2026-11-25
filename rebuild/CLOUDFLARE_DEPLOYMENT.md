# Cloudflare deployment

The rebuild is deployed through the `ScreenNote Cloudflare rebuild` GitHub Actions workflow. The workflow runs typecheck, unit tests, production build, Playwright E2E, then deploys the isolated Cloudflare Worker when the repository secret `CLOUDFLARE_API_TOKEN` is configured.

The deploy token is scoped to Worker deployment and the bindings needed by the Worker. It does not need D1 write permission. The development database's password-attempt migration (`worker/migrations/0004_password_attempt_limits.sql`) was applied directly to the isolated D1 database. For automatic future D1 migrations, add a separate repository secret `CLOUDFLARE_D1_API_TOKEN` with D1 edit/query permission; the migration step is skipped when that secret is absent. Do not broaden the Worker deploy token just to run migrations.

Cloudflare Pages project `screennote-web` is reserved for the Pages Direct Upload path if Git integration remains unavailable. The Worker deployment is the API and application runtime; do not publish an unverified Pages URL as the product URL.
