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
    await page.screenshot({ path: `test-results/screenshots/${viewport.name}-light.png`, fullPage: true });

    await page.getByRole("button", { name: "Toggle appearance" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectContained(page, viewport.width);
    await page.screenshot({ path: `test-results/screenshots/${viewport.name}-dark.png`, fullPage: true });
  }
});

test("imported videos can be previewed and dismissed with Escape", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "walkthrough.webm",
    mimeType: "video/webm",
    buffer: Buffer.from("screen-note-test-video")
  });
  await expect(page.getByRole("heading", { name: "walkthrough" })).toBeVisible();
  await page.getByRole("button", { name: "Play walkthrough" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "walkthrough" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("recording search reports an empty result clearly", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "release-notes.webm",
    mimeType: "video/webm",
    buffer: Buffer.from("test-video")
  });
  await expect(page.getByRole("heading", { name: "release-notes" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search recordings" }).fill("nothing-matches-this");
  await expect(page.getByRole("heading", { name: "No matching recordings" })).toBeVisible();
});