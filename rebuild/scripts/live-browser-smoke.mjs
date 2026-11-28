import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const base = process.env.SCREENNOTE_LIVE_URL || "https://screennote-dev.buttercoder-dev.workers.dev";
const origin = new URL(base).origin;
const sample = fileURLToPath(new URL("../legacy/public/sample.webm", import.meta.url));
const output = path.resolve("test-results/live-browser-smoke");
const password = "LiveScreenNote2026";
await mkdir(output, { recursive: true });

let browser, creatorContext, guestContext, recovery;
try {
  browser = await chromium.launch({ headless: true });
  creatorContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const creator = await creatorContext.newPage();
  creator.on("console", message => { if (message.type() === "error") console.error("[live browser console]", message.text()); });
  creator.on("pageerror", error => console.error("[live browser page error]", error));
  creator.on("requestfailed", request => console.error("[live browser request failed]", request.url(), request.failure()?.errorText));
  creator.on("response", response => { if (response.status() >= 400 && new URL(response.url()).origin === origin) console.error("[live browser HTTP]", response.status(), response.url()); });
  await creator.goto(base, { waitUntil: "domcontentloaded" });
  await creator.getByRole("heading", { name: /Make it clear/i }).waitFor();
  await creator.locator('input[type="file"]').first().setInputFiles(sample);
  const importedHeading = creator.locator(".clip-card h3").first();
  try { await importedHeading.waitFor({ timeout: 20000 }); }
  catch (error) {
    await creator.screenshot({ path: path.join(output, "creator-import-failure.png"), fullPage: true });
    console.error("[live browser import diagnostics]", JSON.stringify({ titles: await creator.locator(".clip-card h3").allTextContents(), statuses: await creator.locator("[role=status]").allTextContents(), body: (await creator.locator("body").innerText()).slice(0, 4000) }));
    throw error;
  }
  const importedTitle = (await importedHeading.textContent() || "").replace(/\s+/g, " ").trim();
  assert.match(importedTitle, /sample/i, "the imported sample file should appear in the library");
  await creator.locator(".clip-thumb").waitFor();
  await creator.screenshot({ path: path.join(output, "creator-library.png"), fullPage: true });

  await creator.getByRole("button", { name: /Preview/i }).click();
  await creator.locator(".preview-workspace video").waitFor();
  await creator.getByRole("button", { name: /Open editor/i }).click();
  await creator.locator(".editor-workspace").waitFor();
  await creator.getByRole("button", { name: "Close editor" }).click();

  await creator.getByRole("button", { name: "Share " + importedTitle }).click();
  await creator.getByRole("heading", { name: "Make a temporary link" }).waitFor();
  await creator.locator(".publish-modal input[type=password]").fill(password);
  await creator.locator(".review-brief-fields > summary").click();
  await creator.getByLabel("Review purpose").fill("Live browser acceptance");
  await creator.getByLabel("Review focus areas").fill("Verify guest feedback and creator controls");
  await creator.getByLabel("Expected outcome").fill("The shared clip is reviewed and can be revoked");
  await creator.getByLabel("Requested action").selectOption("approve");
  await creator.getByRole("button", { name: "Publish temporary link" }).click();
  await creator.locator(".share-link-toast").waitFor({ timeout: 60000 });
  const link = await creator.locator(".share-link-toast a").getAttribute("href");
  assert.ok(link, "publish flow must provide a real share URL");
  const shareUrl = new URL(link, base);
  const token = shareUrl.pathname.split("/").filter(Boolean).at(-1);
  assert.match(token || "", /^[A-Za-z0-9_-]{32,64}$/, "published URL must contain a valid share token");

  const recoveryDownloadPromise = creator.waitForEvent("download");
  await creator.getByRole("button", { name: "Recovery key" }).click();
  const recoveryDownload = await recoveryDownloadPromise;
  const recoveryPath = await recoveryDownload.path();
  assert.ok(recoveryPath, "creator recovery key must download");
  recovery = JSON.parse(await readFile(recoveryPath, "utf8"));
  assert.equal(recovery.format, "screennote-share-recovery");
  assert.equal(recovery.shareToken, token);
  assert.match(recovery.ownerKey, /^[a-f0-9]{64}$/);
  await creator.screenshot({ path: path.join(output, "creator-published.png"), fullPage: true });

  guestContext = await browser.newContext({ viewport: { width: 320, height: 640 }, acceptDownloads: true });
  const guest = await guestContext.newPage();
  await guest.goto(shareUrl.toString(), { waitUntil: "domcontentloaded" });
  await guest.getByRole("heading", { name: "This ScreenNote is private." }).waitFor();
  await guest.getByLabel("Password").fill("wrong-password");
  await guest.getByRole("button", { name: /Unlock video/i }).click();
  await guest.locator(".share-error").waitFor();
  await guest.getByLabel("Password").fill(password);
  await guest.getByRole("button", { name: /Unlock video/i }).click();
  await guest.locator(".share-heading h1").waitFor({ timeout: 20000 });
  await guest.getByRole("heading", { name: "Live browser acceptance" }).waitFor();
  assert.equal(await guest.getByRole("button", { name: "Stop sharing" }).count(), 0, "guest must not receive creator controls");
  const dimensions = await guest.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(dimensions.document <= dimensions.viewport + 1, "live guest viewer must not overflow at 320px: " + JSON.stringify(dimensions));

  const like = guest.getByRole("button", { name: /Like/ }).first();
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true", { timeout: 15000 });

  await guest.getByLabel("Timestamped comment").fill("Live browser QA note");
  await guest.getByRole("button", { name: "Post comment" }).click();
  await guest.getByText("Live browser QA note", { exact: true }).waitFor({ timeout: 15000 });

  await guest.getByRole("button", { name: "Looks good" }).click();
  await guest.getByLabel("Reviewer display name").fill("Live QA guest");
  await guest.getByLabel("Review note").fill("Reviewed through the deployed browser flow.");
  await guest.getByRole("button", { name: "Save decision" }).click();
  await guest.getByText("Your review decision has been saved.", { exact: true }).waitFor({ timeout: 15000 });
  await guest.getByText("Live QA guest", { exact: true }).waitFor();
  await guest.screenshot({ path: path.join(output, "guest-review-320.png"), fullPage: true });

  await creator.goto(shareUrl.toString(), { waitUntil: "domcontentloaded" });
  await creator.getByRole("heading", { name: "This ScreenNote is private." }).waitFor();
  await creator.getByLabel("Password").fill(password);
  await creator.getByRole("button", { name: /Unlock video/i }).click();
  await creator.locator(".share-heading h1").waitFor({ timeout: 20000 });
  await creator.getByRole("button", { name: "Download review packet" }).waitFor();
  await creator.getByRole("button", { name: "Mark changes requested" }).waitFor();
  const packetPromise = creator.waitForEvent("download");
  await creator.getByRole("button", { name: "Download review packet" }).click();
  const packet = await packetPromise;
  assert.match(packet.suggestedFilename(), /review-packet\.md$/);

  const resolveButton = creator.getByRole("button", { name: "Resolve" }).first();
  await resolveButton.waitFor();
  await resolveButton.click();
  await creator.getByText("Resolved", { exact: true }).waitFor();

  await creator.getByRole("button", { name: "Mark changes requested" }).click();
  await creator.locator(".shared-review-status").getByText("Changes requested", { exact: true }).waitFor();
  await creator.getByRole("button", { name: "Mark complete" }).click();
  await creator.locator(".shared-review-status").getByText("Approved", { exact: true }).waitFor();
  await creator.screenshot({ path: path.join(output, "creator-review-1440.png"), fullPage: true });

  creator.once("dialog", dialog => dialog.accept());
  await creator.getByRole("button", { name: "Stop sharing" }).click();
  await creator.getByText(/You stopped sharing/i).waitFor();
  await guest.reload();
  await guest.getByRole("heading", { name: "This moment has ended." }).waitFor({ timeout: 15000 });
  await guest.screenshot({ path: path.join(output, "guest-revoked-320.png"), fullPage: true });

  console.log("Live browser acceptance passed: local import, preview/editor, real password-protected publish, isolated guest unlock/reaction/comment/review, creator moderation/status/packet and revocation.");
} finally {
  if (recovery?.shareToken && recovery?.ownerKey) {
    try {
      const response = await fetch(origin + "/api/share/" + recovery.shareToken + "/manage", {
        method: "DELETE",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ ownerKey: recovery.ownerKey })
      });
      assert.ok([200, 404].includes(response.status), "live smoke cleanup failed with " + response.status);
    } catch (error) { console.error("Live browser smoke cleanup warning:", error); }
  }
  await guestContext?.close().catch(() => undefined);
  await creatorContext?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
