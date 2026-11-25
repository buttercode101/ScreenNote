# Cloudflare deployment

The rebuild is deployed through the `ScreenNote Cloudflare rebuild` GitHub Actions workflow. The workflow runs typecheck, unit tests, production build, Playwright E2E, then deploys the isolated Cloudflare Worker when the repository secret `CLOUDFLARE_API_TOKEN` is configured.

Cloudflare Pages project `screennote-web` is reserved for the Pages Direct Upload path if Git integration remains unavailable. The Worker deployment is the API and application runtime; do not publish an unverified Pages URL as the product URL.
