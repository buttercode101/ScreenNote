import { expect, test } from "@playwright/test";

const viewports = [
  { width: 320, height: 780, name: "320-mobile" },
  { width: 375, height: 812, name: "375-mobile" },
  { width: 768, height: 1024, name: "768-tablet" },
  { width: 1120, height: 900, name: "1120-laptop" },
  { width: 1440, height: 960, name: "1440-desktop" }
];

async function expectContained(page: import("@playwright/test").Page, width: number) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(metrics.document, `document overflow at ${width}px: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(width + 1);
  expect(metrics.body, `body overflow at ${width}px: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(width + 1);
}

test("light and dark layouts remain contained from 320px through desktop", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectContained(page, viewport.width);
    if (viewport.width <= 480) {
      const geometry = await page.evaluate(() => {
        const rect = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height }; };
        return { title:rect(".welcome-row h1"), art:rect(".welcome-art"), intro:rect(".welcome-row .intro"), record:rect(".capture-actions .button") };
      });
      const overlaps = (a: typeof geometry.title, b: typeof geometry.title) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      expect(overlaps(geometry.title, geometry.art), "mobile hero title and illustration must not overlap").toBe(false);
      expect(overlaps(geometry.intro, geometry.art), "mobile intro and illustration must not overlap").toBe(false);
      expect(geometry.record.height, "primary recording action must meet a 44px touch target").toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `test-results/screenshots/${viewport.name}-light.png`, fullPage: true });

    await page.getByRole("button", { name: "Toggle appearance" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectContained(page, viewport.width);
    await page.screenshot({ path: `test-results/screenshots/${viewport.name}-dark.png`, fullPage: true });
  }
});

test("imported videos can be previewed and dismissed with Escape", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"][accept*="video"]').setInputFiles({
    name: "walkthrough.webm",
    mimeType: "video/webm",
    buffer: Buffer.from("screen-note-test-video")
  });
  await expect(page.getByRole("heading", { name: "walkthrough" })).toBeVisible();
  await page.getByRole("button", { name: "Play walkthrough" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "walkthrough" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("recording search reports an empty result clearly", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"][accept*="video"]').setInputFiles({
    name: "release-notes.webm",
    mimeType: "video/webm",
    buffer: Buffer.from("test-video")
  });
  await expect(page.getByRole("heading", { name: "release-notes" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search recordings" }).fill("nothing-matches-this");
  await expect(page.getByRole("heading", { name: "No matching recordings" })).toBeVisible();
});
test("temporary viewer is guest-accessible and accepts timestamped discussion", async ({ page }) => {
  const token = "AbCdEf0123456789_-AbCdEf0123456789_-AbCdEf0";
  const base = "**/api/share/" + token;
  const comments: Array<{id:string;parentId:string|null;viewerLabel:string;body:string;time:number;createdAt:number;updatedAt:number;resolved:number;deletedAt:null;anchorX?:number;anchorY?:number}> = [];
  await page.route(base, route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ title: "Checkout bug", mimeType: "video/webm", size: 4096, duration: 42, expiresAt: Math.floor(Date.now()/1000)+86400, passwordRequired: false }) }));
  await page.route(base + "/media", route => route.fulfill({ status: 200, contentType: "video/webm", body: Buffer.from([0x1a,0x45,0xdf,0xa3]) }));
  await page.route(base + "/comments", async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      comments.push({ id: "comment-1", parentId: body.parentId ?? null, viewerLabel: "Guest", body: body.text, time: body.time, createdAt: Math.floor(Date.now()/1000), updatedAt: Math.floor(Date.now()/1000), resolved: 0, deletedAt: null, anchorX: body.anchorX, anchorY: body.anchorY });
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "comment-1", createdAt: Math.floor(Date.now()/1000) }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ comments }) });
    }
  });
  await page.goto("/s/" + token);
  await expect(page.getByRole("heading", { name: "Checkout bug" })).toBeVisible();
  await expect(page.getByText("No comments yet.")).toBeVisible();
  await page.getByRole("button", { name: "Pin a point on the frame" }).click();
  await page.locator(".annotation-layer").click({ position: { x: 80, y: 60 } });
  await expect(page.locator(".pending-annotation-pin")).toBeVisible();
  await page.locator(".share-comment-form textarea").fill("The checkout button disappears here.");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.locator(".share-comment").getByText("The checkout button disappears here.")).toBeVisible();
  await expect(page.locator(".frame-annotation-pin")).toBeVisible();
});

test("privacy route explains local originals and temporary retention", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Your original stays with you." })).toBeVisible();
  await expect(page.getByText(/Stopping a share deletes its R2 video object/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to ScreenNote" })).toBeVisible();
});
