import { describe, expect, it } from "vitest";
// @ts-expect-error Shared browser JavaScript module has no declaration file.
import { paintMarkup } from "../legacy/public/markup.js";

function context() {
  const calls: Array<{ name: string; args: unknown[]; fillStyle?: unknown; strokeStyle?: unknown; filter?: unknown }> = [];
  const ctx: any = {
    fillStyle: "", strokeStyle: "", lineWidth: 0, filter: "none",
    save() { calls.push({ name: "save", args: [] }); },
    restore() { calls.push({ name: "restore", args: [] }); },
    fillRect(...args: unknown[]) { calls.push({ name: "fillRect", args, fillStyle: this.fillStyle }); },
    strokeRect(...args: unknown[]) { calls.push({ name: "strokeRect", args, strokeStyle: this.strokeStyle }); },
    beginPath() { calls.push({ name: "beginPath", args: [] }); },
    moveTo(...args: unknown[]) { calls.push({ name: "moveTo", args }); },
    lineTo(...args: unknown[]) { calls.push({ name: "lineTo", args }); },
    stroke() { calls.push({ name: "stroke", args: [] }); },
    rect(...args: unknown[]) { calls.push({ name: "rect", args }); },
    clip() { calls.push({ name: "clip", args: [] }); },
    drawImage(...args: unknown[]) { calls.push({ name: "drawImage", args }); }
  };
  return { ctx, calls };
}

describe("frame-normalized annotations", () => {
  it("scales normalized coordinates to the output frame", () => {
    const { ctx, calls } = context();
    paintMarkup(ctx, 1000, 500, [{ kind: "rectangle", x: .1, y: .2, w: .3, h: .4 }]);
    expect(calls.find(x => x.name === "strokeRect")?.args).toEqual([100, 100, 300, 200]);
  });

  it("renders privacy redactions as opaque dark fills, not translucent highlights", () => {
    const { ctx, calls } = context();
    paintMarkup(ctx, 800, 450, [{ kind: "redact", x: .25, y: .2, w: .5, h: .3 }]);
    const fill = calls.find(x => x.name === "fillRect");
    expect(fill?.args).toEqual([200, 90, 400, 135]);
    expect(fill?.fillStyle).toBe("#161a17");
  });

  it("clips blur effects to the selected region", () => {
    const { ctx, calls } = context();
    paintMarkup(ctx, 800, 450, [{ kind: "blur", x: .1, y: .1, w: .2, h: .2 }]);
    expect(calls.some(x => x.name === "clip")).toBe(true);
    expect(calls.some(x => x.name === "drawImage")).toBe(true);
  });

  it("renders arrows and translucent highlights using distinct drawing paths", () => {
    const { ctx, calls } = context();
    paintMarkup(ctx, 640, 360, [
      { kind: "arrow", x: .1, y: .2, w: .3, h: .4 },
      { kind: "highlight", x: .5, y: .5, w: .2, h: .2 }
    ]);
    expect(calls.filter(x => x.name === "lineTo").length).toBeGreaterThanOrEqual(2);
    expect(calls.some(x => x.name === "fillRect" && x.fillStyle === "rgba(255,210,40,.32)")).toBe(true);
  });
});
