import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const viewports = [
  {width:320,height:780,name:"320-mobile"},
  {width:360,height:800,name:"360-mobile"},
  {width:375,height:812,name:"375-mobile"},
  {width:390,height:844,name:"390-mobile"},
  {width:414,height:896,name:"414-mobile"},
  {width:600,height:900,name:"600-small-tablet"},
  {width:768,height:1024,name:"768-tablet"},
  {width:834,height:1112,name:"834-tablet"},
  {width:1024,height:900,name:"1024-laptop"},
  {width:1120,height:900,name:"1120-laptop"},
  {width:1280,height:900,name:"1280-desktop"},
  {width:1440,height:960,name:"1440-desktop"},
  {width:1920,height:1080,name:"1920-wide"}
];

async function contained(page: import("@playwright/test").Page, width:number) {
  const m=await page.evaluate(()=>{
    const selectors=".button,.btn,button,input,select,textarea,.clip-card,.clip-grid,.capture-panel,.share-layout,.share-discussion,.modal,.preview-modal,.publish-modal,[role=dialog]";
    const offenders=[...document.querySelectorAll<HTMLElement>(selectors)].filter(el=>{
      const style=getComputedStyle(el),r=el.getBoundingClientRect();
      return style.display!=="none"&&style.visibility!=="hidden"&&r.width>0&&(r.left < -1 || r.right > innerWidth+1);
    }).map(el=>({tag:el.tagName,selector:el.className?.toString?.()||el.id||"",left:Math.round(el.getBoundingClientRect().left),right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)}));
    return {doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth,offenders};
  });
  expect(m.doc, `document horizontal overflow at ${width}px: ${JSON.stringify(m)}`).toBeLessThanOrEqual(width+1);
  expect(m.body, `body horizontal overflow at ${width}px: ${JSON.stringify(m)}`).toBeLessThanOrEqual(width+1);
  expect(m.offenders, `visible controls or content panels escape the viewport at ${width}px`).toEqual([]);
}

test.beforeAll(async()=>{await mkdir("test-results/screenshots",{recursive:true});});

test("original ScreenNote layout stays contained at 13 widths in light and dark",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  for(const v of viewports){
    await page.setViewportSize({width:v.width,height:v.height});
    await contained(page,v.width);
    if([320,375,768,1120,1440].includes(v.width))await page.screenshot({path:`test-results/screenshots/${v.name}-light.png`,fullPage:true});
  }
  await page.getByRole("button",{name:"Toggle light or dark mode"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  for(const v of viewports){
    await page.setViewportSize({width:v.width,height:v.height});
    await contained(page,v.width);
    if([320,375,768,1120,1440].includes(v.width))await page.screenshot({path:`test-results/screenshots/${v.name}-dark.png`,fullPage:true});
  }
});

test("import, title, captions, chapters and bug-report context persist locally",async({page})=>{
  await page.goto("/");
  await page.locator("#import-video").setInputFiles(path.resolve("legacy/public/sample.webm"));
  await expect(page.getByRole("heading",{name:"Review & share"})).toBeVisible({timeout:20000});
  await expect(page.locator("#player")).toBeVisible();
  const title="A very long but valid walkthrough title that should wrap without pushing the review screen outside the viewport";
  const savedTitle=title.slice(0,100);
  await page.locator("#recording-title-input").fill(title);
  await page.getByRole("button",{name:"Save title"}).click();
  await expect(page.locator("#title-status")).toHaveText("Title saved.");
  await page.getByText("Captions, chapters & bug report",{exact:true}).click();
  await page.locator("#captions-text").fill("WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nReview this step.");
  await page.locator("#chapters-text").fill("0:01 Opening");
  await page.locator("#report-url").fill("https://example.com/checkout/with/a/very/long/path/that/should-wrap-cleanly/".repeat(4));
  await page.locator("#report-steps").fill("Open the checkout and select the payment method. ".repeat(8)+" unbroken-token-".repeat(35));
  await page.locator("#report-expected").fill("The payment option remains visible.");
  await page.locator("#report-actual").fill("The payment option disappears.");
  await page.locator("#extras-form button[type=submit]").click();
  await expect(page.locator("#extras-status")).toHaveText("Video context saved.");
  await expect(page.locator("#export-captions")).toBeEnabled();
  const download=page.waitForEvent("download");
  await page.locator("#export-report").click();
  expect((await download).suggestedFilename()).toContain("bug-report");
  await expect(page.locator("#recording-title-input")).toHaveValue(savedTitle);
  for(const width of [320,375,768]){await page.setViewportSize({width,height:900});await contained(page,width);}
});

test("screen capture can pause, resume and save a private local recording",async({page})=>{
  await page.addInitScript(()=>{
    const canvas=document.createElement("canvas");canvas.width=640;canvas.height=360;
    const ctx=canvas.getContext("2d");if(!ctx||!canvas.captureStream)throw Error("Canvas capture not supported");
    let frame=0;const paint=()=>{ctx.fillStyle=frame%2?"#e7efe8":"#f7f6f2";ctx.fillRect(0,0,640,360);ctx.fillStyle="#235a45";ctx.font="bold 30px sans-serif";ctx.fillText("ScreenNote capture "+frame,32,72);frame++;requestAnimationFrame(paint)};paint();
    const stream=canvas.captureStream(15);
    Object.defineProperty(navigator.mediaDevices,"getDisplayMedia",{configurable:true,value:async()=>stream});
  });
  await page.goto("/");
  for(const id of ["mic","camera","system"]){const el=page.locator("#"+id);if(await el.isChecked())await el.uncheck();}
  await page.locator('[data-action="record"]').click();
  await expect(page.getByRole("heading",{name:"Prepare your recording."})).toBeVisible({timeout:10000});
  await page.getByRole("button",{name:/Begin recording/}).click();
  await expect(page.locator("#live-actions")).toBeVisible({timeout:10000});
  await page.waitForTimeout(1200);
  await page.locator("#pause-button").click();
  await expect(page.locator("#recording-status")).toContainText("PAUSED");
  await page.waitForTimeout(250);
  await page.locator("#pause-button").click();
  await expect(page.locator("#recording-status")).toContainText("RECORDING");
  await page.waitForTimeout(1200);
  await page.locator('[data-action="stop"]').click();
  await expect(page.getByRole("heading",{name:"Review & share"})).toBeVisible({timeout:20000});
  await expect(page.locator("#player")).toBeVisible();
  await expect(page.locator("#recording-title-input")).toBeVisible();
});

test("appearance, local library and portable backup persist across a fresh browser",async({page,browser})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"Toggle light or dark mode"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.getByRole("button",{name:"Toggle light or dark mode"}).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await page.locator("#import-video").setInputFiles(path.resolve("legacy/public/sample.webm"));
  await expect(page.getByRole("heading",{name:"Review & share"})).toBeVisible({timeout:20000});
  await page.locator("#main").getByRole("button",{name:"My recordings"}).click();
  await expect(page.locator(".clip-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".clip-card")).toHaveCount(1);
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Back up library"}).click();
  const backup=await downloadPromise;expect(backup.suggestedFilename()).toMatch(/\.snbackup$/);
  const backupPath=await backup.path();expect(backupPath).toBeTruthy();
  const freshContext=await browser.newContext(),freshPage=await freshContext.newPage();
  await freshPage.goto("/");
  await freshPage.locator("#restore-library-backup").setInputFiles(backupPath!);
  await freshPage.waitForTimeout(300);
  const restoreOpen=await freshPage.locator("#modal").evaluate((el:any)=>el.open);
  if(!restoreOpen)throw new Error("Library backup restore failed: "+await freshPage.locator("#error").innerText()+" "+await freshPage.locator("#notice").innerText());
  await expect(freshPage.locator("#modal")).toContainText("Restore your ScreenNote library");
  await freshPage.getByRole("button",{name:"Restore backup"}).click();
  await expect(freshPage.locator(".clip-card")).toHaveCount(1);
  await freshPage.reload();
  await expect(freshPage.locator(".clip-card")).toHaveCount(1);
  await freshContext.close();
});

test("installable app shell keeps the local library usable offline",async({page,context})=>{
  await page.goto("/");
  await page.locator("#import-video").setInputFiles(path.resolve("legacy/public/sample.webm"));
  await expect(page.getByRole("heading",{name:"Review & share"})).toBeVisible({timeout:20000});
  await page.locator("#main").getByRole("button",{name:"My recordings"}).click();
  await expect(page.locator(".clip-card")).toHaveCount(1);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();
  await page.evaluate(async()=>{if(navigator.serviceWorker.controller)return;await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener("controllerchange",()=>resolve(),{once:true}));});
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading",{name:/Your recordings|Show it/})).toBeVisible({timeout:10000});
  await expect(page.locator(".clip-card")).toHaveCount(1);
  await expect(page.locator("#import-video")).toBeAttached();
  await context.setOffline(false);
});


test("real legacy share viewer and privacy route remain contained across widths and themes",async({page})=>{
  const id="123e4567-e89b-12d3-a456-426614174000";
  await page.route(/\/api\/clip\?op=view/,async route=>{
    const url=new URL(route.request().url());
    if(url.searchParams.get("id")!==id){await route.continue();return;}
    await route.fulfill({json:{
      id,title:"A very long ScreenNote title that must wrap naturally without forcing the viewer outside the available screen width",
      reviewStatus:"needs-feedback",width:1280,height:720,start:0,end:95,duration:95,
      createdAt:Date.now(),expiresAt:Date.now()+86400000,passwordProtected:false,
      discussionRevision:0,captions:[],chapters:[],report:null,comments:[],
      reactions:{like:0,thanks:0,idea:0},mediaUrl:"/sample.webm"
    }});
  });
  await page.goto("/v/"+id);
  await expect(page.locator(".viewer-grid")).toBeVisible();
  await expect(page.locator(".reply-panel")).toContainText("Talk about this moment.");
  for(const theme of ["light","dark"]){
    await page.evaluate(value=>document.documentElement.setAttribute("data-theme",value),theme);
    for(const width of [320,360,375,390,414,600,768,834,1024,1120,1280,1440,1920]){
      await page.setViewportSize({width,height:900});
      await contained(page,width);
    }
  }
  await page.goto("/privacy");
  await expect(page.getByRole("heading",{name:"Your original stays with you."})).toBeVisible();
  for(const theme of ["light","dark"]){
    await page.evaluate(value=>document.documentElement.setAttribute("data-theme",value),theme);
    for(const width of [320,360,375,390,414,600,768,834,1024,1120,1280,1440,1920]){
      await page.setViewportSize({width,height:900});
      await contained(page,width);
    }
  }
});
