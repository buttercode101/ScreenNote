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
    await page.evaluate(() => localStorage.setItem("screennote-theme", "light"));
    await page.reload();
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

test("screen capture can pause, resume, and save a private local recording", async ({ page }) => {
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360;
    const context = canvas.getContext("2d");
    if (!context || typeof canvas.captureStream !== "function") throw new Error("Canvas capture is unavailable in this test browser.");
    let frame = 0;
    const paint = () => {
      context.fillStyle = frame % 2 ? "#e8f0e9" : "#f7f7f4";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#1d5945";
      context.font = "bold 32px sans-serif";
      context.fillText("ScreenNote capture test " + frame, 36, 80);
      frame++;
      requestAnimationFrame(paint);
    };
    paint();
    const displayStream = canvas.captureStream(15);
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", { configurable:true, value:async () => displayStream });
  });
  await page.goto("/");
  await page.getByLabel("Microphone").uncheck();
  await page.getByLabel("System audio").uncheck();
  await page.locator(".capture-actions .button.primary").click();
  await expect(page.getByText(/RECORDING/)).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name:"Pause", exact:true }).click();
  await expect(page.getByText(/PAUSED/)).toBeVisible();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name:"Resume", exact:true }).click();
  await expect(page.getByText(/RECORDING/)).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name:"Finish", exact:true }).click();
  await expect(page.getByText("Recording saved privately on this device.")).toBeVisible({timeout:15000});
  await expect(page.locator(".clip-card")).toHaveCount(1);
  await expect(page.locator(".clip-card").first()).toContainText("Screen recording");
  await page.getByRole("button", { name:/Play Screen recording/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForFunction(() => (document.querySelector(".preview-video") as HTMLVideoElement | null)?.readyState! >= 1);
  await page.getByLabel("From (seconds)").fill("0.2");
  await page.getByLabel("To (seconds)").fill("1.5");
  await page.getByRole("button", { name:"Save trimmed copy", exact:true }).click();
  await expect(page.getByText("Trimmed copy saved locally. Your original is unchanged.")).toBeVisible({timeout:15000});
  await expect(page.locator(".clip-card")).toHaveCount(2);
  await expect(page.locator(".clip-card").filter({hasText:"trimmed"})).toHaveCount(1);
});

test("appearance preference survives reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Toggle appearance" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("password gate, comment ownership actions, and share revocation work in the viewer UI", async ({ page }) => {
  const token = "PwGate0123456789_-PwGate0123456789_-PwGate01";
  const base = "**/api/share/" + token;
  const ownerKey = "a".repeat(64);
  let unlocked = false;
  let revoked = false;
  let comment: { id:string; parentId:string|null; viewerLabel:string; body:string; time:number; createdAt:number; updatedAt:number; resolved:number; deletedAt:number|null; anchorX:number|null; anchorY:number|null; isMine:boolean } = { id:"comment-1", parentId:null, viewerLabel:"Guest", body:"Original note", time:5, createdAt:Math.floor(Date.now()/1000), updatedAt:Math.floor(Date.now()/1000), resolved:0, deletedAt:null, anchorX:null, anchorY:null, isMine:true };
  await page.addInitScript(({ token, ownerKey }: { token:string; ownerKey:string }) => {
    localStorage.setItem("screennote-recovery-" + token, ownerKey);
    localStorage.setItem("screennote-author-" + token, "b".repeat(48));
  }, { token, ownerKey });
  await page.route(base, route => {
    if (revoked) return route.fulfill({ status:404, contentType:"application/json", body:JSON.stringify({error:"Not found"}) });
    if (!unlocked) return route.fulfill({ status:401, contentType:"application/json", body:JSON.stringify({error:"Password required"}) });
    return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ title:"Private walkthrough", mimeType:"video/webm", size:4096, duration:42, expiresAt:Math.floor(Date.now()/1000)+86400, passwordRequired:true }) });
  });
  await page.route(base + "/access", async route => {
    const body = route.request().postDataJSON();
    if (body.password !== "correct horse") return route.fulfill({ status:401, contentType:"application/json", body:JSON.stringify({error:"That password didn't work."}) });
    unlocked = true;
    return route.fulfill({ status:200, headers:{"set-cookie":"sn-access=valid; HttpOnly; Path=/api/share/"+token+"; Secure; SameSite=Lax"}, contentType:"application/json", body:JSON.stringify({ok:true}) });
  });
  await page.route(base + "/media", route => route.fulfill({ status:200, contentType:"video/webm", body:Buffer.from([0x1a,0x45,0xdf,0xa3]) }));
  await page.route(base + "/comments", async route => {
    if (route.request().method() === "POST") return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({id:"new-comment",createdAt:Math.floor(Date.now()/1000)})});
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({comments:comment.deletedAt?[{...comment}]:[{...comment}]})});
  });
  await page.route(base + "/comments/comment-1/resolve", async route => {
    comment.resolved = route.request().postDataJSON().resolved ? 1 : 0;
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true})});
  });
  await page.route(base + "/comments/comment-1", async route => {
    if (route.request().method() === "PATCH") comment.body = route.request().postDataJSON().text;
    else if (route.request().method() === "DELETE") comment.deletedAt = Math.floor(Date.now()/1000);
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true})});
  });
  await page.route(base + "/manage", route => {
    revoked = true;
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true})});
  });
  await page.goto("/s/" + token);
  await expect(page.getByRole("heading", {name:"This ScreenNote is private."})).toBeVisible();
  await page.getByPlaceholder("Enter sharing password").fill("wrong");
  await page.getByRole("button", {name:"Unlock video"}).click();
  await expect(page.getByText("That password didn't work.")).toBeVisible();
  await page.getByPlaceholder("Enter sharing password").fill("correct horse");
  await page.getByRole("button", {name:"Unlock video"}).click();
  await expect(page.getByRole("heading", {name:"Private walkthrough"})).toBeVisible();
  await expect(page.getByText("Original note")).toBeVisible();
  await page.once("dialog", dialog => dialog.accept("Updated note"));
  await page.getByRole("button", {name:"Edit", exact:true}).click();
  await expect(page.getByText("Updated note")).toBeVisible();
  await page.getByRole("button", {name:"Resolve", exact:true}).click();
  await expect(page.getByText("Resolved")).toBeVisible();
  await page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", {name:"Delete", exact:true}).click();
  await expect(page.getByText("This comment was removed.")).toBeVisible();
  await page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", {name:"Stop sharing", exact:true}).click();
  await expect(page.getByRole("heading", {name:"This moment has ended."})).toBeVisible();
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
