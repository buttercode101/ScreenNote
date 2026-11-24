import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./worker/index.ts" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "screennote-dev",
    entrypoint,
    compatibilityDate: "2026-11-25",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/api/*"]
    },
    env: {
      DB: bindings.d1({ name: "screennote-dev", id: "44a5859b-6411-4513-bd17-3302fbbc0575" }),
      MEDIA: bindings.r2({ name: "screennote-media-dev" }),
      ASSETS: bindings.assets()
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true, headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.1 }
    }
  }
});