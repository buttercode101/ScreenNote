import { bindings, defineConfig, triggers } from "cf/config";
import * as entrypoint from "./worker/index.ts" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "screennote-dev",
    entrypoint,
    compatibilityDate: "2026-11-24",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/*"]
    },
    env: {
      DB: bindings.d1({ name: "screennote-dev", id: "44a5859b-6411-4513-bd17-3302fbbc0575" }),
      MEDIA: bindings.r2({ name: "screennote-media-dev" }),
      STATIC: bindings.r2({ name: "screennote-static-dev" }),
      ASSETS: bindings.assets()
    },
    triggers: [triggers.scheduled({ schedule: "*/15 * * * *" })],
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true, headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.1 }
    }
  }
});