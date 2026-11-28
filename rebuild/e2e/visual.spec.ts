import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
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
    const selectors="button,input,select,textarea,.clip-card,.clip-grid,.capture-panel,.preview-modal,.publish-modal,.preview-workspace,.preview-workspace-content,.editor-workspace,.editor-topline,.editor-body,.editor-stage,.editor-toolbar,.editor-side,.editor-card,.annotation-list,.context-editor,.editor-tabs,.share-page,.share-topbar,.share-layout,.share-video-wrap,.share-discussion,.share-comment-form,.guest-review-panel,.review-decision-options,.review-response-list,[role=dialog]";
    const offenders=[...document.querySelectorAll<HTMLElement>(selectors)].filter(el=>{
      const style=getComputedStyle(el),r=el.getBoundingClientRect();
      return style.display!=="none"&&style.visibility!=="hidden"&&r.width>0&&(r.left < -1 || r.right > innerWidth+1);
    }).map(el=>({tag:el.tagName,selector:el.className?.toString?.()||el.id||"",left:Math.round(el.getBoundingClientRect().left),right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)}));
    return {doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth,offenders};
  });
  expect(m.doc, `document horizontal overflow at ${width}px: ${JSON.stringify(m)}`).toBeLessThanOrEqual(width+1);
  expect(m.body, `body horizontal overflow at ${width}px: ${JSON.stringify(m)}`).toBeLessThanOrEqual(width+1);
  expect(m.offenders, `visible controls or content panels escape viewport at ${width}px`).toEqual([]);
}

async function assertNamedControls(page:import("@playwright/test").Page){
  const missing=await page.evaluate(()=>{
    const elements=[...document.querySelectorAll<HTMLElement>('button,input:not([type="hidden"]),select,textarea,[role="button"],[role="slider"]')].filter(el=>{const style=getComputedStyle(el);return style.display!=="none"&&style.visibility!=="hidden"&&el.getClientRects().length>0});
    const name=(el:HTMLElement)=>{
      const aria=el.getAttribute("aria-label")?.trim();
      const labelled=el.getAttribute("aria-labelledby")?.split(/\\s+/).map(id=>document.getElementById(id)?.textContent?.trim()||"").join(" ").trim();
      const labels=el instanceof HTMLInputElement||el instanceof HTMLSelectElement||el instanceof HTMLTextAreaElement?[...(el.labels||[])].map(label=>label.textContent?.trim()||"").join(" ").trim():"";
      const text=el.tagName==="BUTTON"||el.getAttribute("role")==="button"?el.textContent?.trim():"";
      return aria||labelled||labels||el.getAttribute("title")?.trim()||text||"";
    };
    return elements.filter(el=>!name(el)).map(el=>({tag:el.tagName,type:(el as HTMLInputElement).type||"",id:el.id,classes:el.className?.toString?.()||""}));
  });
  expect(missing, "visible controls must expose an accessible name").toEqual([]);
}

async function assertTextContrast(page:import("@playwright/test").Page,label:string){
  const violations=await page.evaluate(()=>{
    const parse=(value:string)=>{const numbers=value.match(/[\d.]+/g)?.map(Number)||[];return numbers.length>=3?{r:numbers[0],g:numbers[1],b:numbers[2],a:numbers.length>3?numbers[3]:1}:null};
    const linear=(v:number)=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
    const luminance=(v:{r:number;g:number;b:number})=>.2126*linear(v.r)+.7152*linear(v.g)+.0722*linear(v.b);
    const ratio=(a:{r:number;g:number;b:number},b:{r:number;g:number;b:number})=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]+.05)/(values[1]+.05)};
    const nodes=[...document.querySelectorAll<HTMLElement>("body *")];
    const failures:string[]=[];
    for(const el of nodes){
      const own=getComputedStyle(el),rect=el.getBoundingClientRect();
      if(own.display==="none"||own.visibility==="hidden"||!rect.width||!rect.height||el.closest('[aria-hidden="true"]'))continue;
      const text=Array.from(el.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent||"").join(" ").trim();
      if(!text)continue;
      const foreground=parse(own.color);if(!foreground)continue;
      let background={r:255,g:255,b:255};
      const chain:HTMLElement[]=[];let parent:HTMLElement|null=el;while(parent){chain.unshift(parent);parent=parent.parentElement;}
      for(const ancestor of chain){const color=parse(getComputedStyle(ancestor).backgroundColor);if(color&&color.a>0){background={r:color.r*color.a+background.r*(1-color.a),g:color.g*color.a+background.g*(1-color.a),b:color.b*color.a+background.b*(1-color.a)};}}
      const fg={r:foreground.r*foreground.a+background.r*(1-foreground.a),g:foreground.g*foreground.a+background.g*(1-foreground.a),b:foreground.b*foreground.a+background.b*(1-foreground.a)};
      const size=parseFloat(own.fontSize)||16,weight=parseInt(own.fontWeight)||400,minimum=size>=24||(size>=18.66&&weight>=700)?3:4.5;
      const value=ratio(fg,background);
      if(value+0.01<minimum)failures.push(el.tagName.toLowerCase()+"."+String(el.className||"").toString().replace(/\s+/g,".")+" text="+text.slice(0,72)+" contrast="+value.toFixed(2)+" required="+minimum+" fg="+JSON.stringify(fg)+" bg="+JSON.stringify(background)+" ownColor="+own.color+" ownBg="+own.backgroundColor+" opacity="+own.opacity);
    }
    return failures.slice(0,80);
  });
  expect(violations,label+" visible text must meet WCAG AA contrast").toEqual([]);
}

test.beforeAll(async()=>{await mkdir("test-results/screenshots",{recursive:true});});

test("PWA install metadata and native install prompt work",async({page})=>{
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href","/manifest.webmanifest");
  const manifest=await page.evaluate(async()=>await(await fetch("/manifest.webmanifest")).json() as {display:string;start_url:string;icons:Array<{src:string;sizes:string;purpose?:string}>});
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.icons).toEqual(expect.arrayContaining([expect.objectContaining({src:"/icon-192.svg",sizes:"192x192"}),expect.objectContaining({src:"/icon-512.svg",sizes:"512x512",purpose:"any maskable"})]));
  const worker=await page.evaluate(async()=>await(await fetch("/sw.js")).text());
  expect(worker).toContain("screennote-pwa-shell-v5");
  await page.evaluate(()=>{
    const event=new Event("beforeinstallprompt",{cancelable:true});
    Object.defineProperty(event,"prompt",{value:async()=>{(window as Window & {__snPrompted?:boolean}).__snPrompted=true;}});
    Object.defineProperty(event,"userChoice",{value:Promise.resolve({outcome:"accepted",platform:"test"})});
    window.dispatchEvent(event);
  });
  const install=page.getByRole("button",{name:"Install ScreenNote"});
  await expect(install).toBeVisible();
  await install.click();
  await expect(install).toHaveCount(0);
  expect(await page.evaluate(()=>Boolean((window as Window & {__snPrompted?:boolean}).__snPrompted))).toBe(true);
});

test("independent React workspace is contained at 13 widths, short landscape heights and light/dark",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1,name:/Make it clear/i})).toBeVisible();
  await assertTextContrast(page,"workspace light");
  await page.setViewportSize({width:320,height:780});
  const mobileHeader=await page.evaluate(()=>({topbar:document.querySelector(".topbar")?.getBoundingClientRect().height,breadcrumb:document.querySelector(".breadcrumb")?.getBoundingClientRect().height,secure:document.querySelector(".secure-label")?.getBoundingClientRect().width}));
  expect(mobileHeader.topbar, "mobile utility bar should remain compact").toBeLessThanOrEqual(64);
  expect(mobileHeader.breadcrumb, "mobile breadcrumb should stay on one line").toBeLessThanOrEqual(22);
  expect(mobileHeader.secure, "mobile privacy status should collapse to its icon").toBeLessThanOrEqual(18);
  await expect(page.locator(".empty-state")).toHaveCSS("border-style","solid");
  await expect(page.locator('script[type="module"][src="/src/main.tsx"]')).toHaveCount(1);
  await expect(page.locator("#app")).toHaveCount(0);
  for(const v of viewports){
    await page.setViewportSize({width:v.width,height:v.height});
    await contained(page,v.width);
    if([320,375,768,1120,1440].includes(v.width))await page.screenshot({path:`test-results/screenshots/${v.name}-light.png`,fullPage:true});
  }
  await page.getByRole("button",{name:"Toggle appearance"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await assertTextContrast(page,"workspace dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content","#171d19");
  await expect(page.locator(".capture-panel")).toHaveCSS("background-color","rgb(41, 59, 46)");
  for(const v of viewports){
    await page.setViewportSize({width:v.width,height:v.height});
    await contained(page,v.width);
    if([320,375,768,1120,1440].includes(v.width))await page.screenshot({path:`test-results/screenshots/${v.name}-dark.png`,fullPage:true});
  }
  const landscape=[{width:320,height:480},{width:568,height:320},{width:844,height:390},{width:1024,height:600}];
  for(const v of landscape){await page.setViewportSize(v);await contained(page,v.width);}
  await page.getByRole("button",{name:"Toggle appearance"}).click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content","#f4f2ec");
  for(const v of landscape){await page.setViewportSize(v);await contained(page,v.width);}
  await page.setViewportSize({width:320,height:640});
  await contained(page,320);
});

test("high-DPI mobile viewport keeps controls contained and reachable",async({browser})=>{
  const context=await browser.newContext({viewport:{width:320,height:640},deviceScaleFactor:2});
  const page=await context.newPage();
  await page.goto("/");
  await contained(page,320);
  await page.getByRole("button",{name:"Open preferences"}).click();
  await expect(page.getByRole("dialog",{name:/Preferences & backups/i})).toBeVisible();
  await contained(page,320);
  await page.getByRole("button",{name:/Close preferences/i}).click();
  await context.close();
});

test("Android native recording handoff imports the private MP4 into the PWA library",async({page})=>{
  const nativeId="native-test-recording-123";
  const sample=await readFile(path.resolve("legacy/public/sample.webm"));
  await page.addInitScript("window.__ANDROID_APP__ = true;");
  await page.route("**/__native_recordings/"+nativeId,route=>route.fulfill({status:200,contentType:"video/webm",body:sample,headers:{"cache-control":"no-store"}}));
  await page.goto("/?nativeRecording="+nativeId);
  await expect(page.locator(".clip-card h3").filter({hasText:"ScreenNote native recording "+nativeId})).toBeVisible({timeout:20000});
  await expect(page.locator(".preview-workspace")).toBeVisible({timeout:20000});
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".preview-workspace video")).toBeVisible();
});

test("imported recording opens the full editor with preview, annotations, captions and sharing",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve("legacy/public/sample.webm"));
  await expect(page.getByRole("heading",{name:"sample"})).toBeVisible({timeout:15000});
  await expect(page.locator(".clip-thumb")).toBeVisible();
  await expect(page.locator(".clip-thumb img, .clip-thumb-fallback").first()).toBeVisible({timeout:10000});
  await assertNamedControls(page);
  await expect(page.getByRole("button",{name:/Preview/i})).toBeVisible();
  await expect(page.getByRole("button",{name:/Edit/i})).toBeVisible();
  await page.setViewportSize({width:320,height:780});
  const clipActionHeights=await page.locator(".clip-actions .icon-button").evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
  expect(clipActionHeights.length).toBeGreaterThan(0);expect(clipActionHeights.every(height=>height>=44)).toBe(true);
  const clipTitleBlock=await page.locator(".clip-info > div:first-child").first().boundingBox();expect(clipTitleBlock?.width).toBeGreaterThan(180);
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole("button",{name:/Preview/i}).click();
  await expect(page.locator(".preview-workspace")).toBeVisible();
  await assertTextContrast(page,"preview light");
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","dark"));
  await assertTextContrast(page,"preview dark");
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","light"));
  await expect(page.locator(".preview-workspace video")).toBeVisible();
  await assertNamedControls(page);
  const previewDialog=page.locator(".preview-workspace"),previewButtons=previewDialog.locator("button");
  await previewButtons.first().focus();await page.keyboard.press("Shift+Tab");await expect(previewButtons.last()).toBeFocused();await page.keyboard.press("Tab");await expect(previewButtons.first()).toBeFocused();
  await expect(previewButtons.first()).toHaveCSS("outline-color","rgb(49, 91, 69)");
  for(const width of [320,375,768,1120,1440]){await page.setViewportSize({width,height:900});await contained(page,width);if([320,1440].includes(width)){await page.screenshot({path:`test-results/screenshots/preview-${width}.png`,fullPage:true});await page.screenshot({path:`test-results/screenshots/preview-viewport-${width}.png`});}}
  await page.getByRole("button",{name:/Open editor/i}).click();
  await expect(page.locator(".editor-workspace")).toBeVisible();
  await assertTextContrast(page,"editor light");
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","dark"));
  await assertTextContrast(page,"editor dark");
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","light"));
  await assertNamedControls(page);
  await expect(page.locator(".editor-video-wrap video")).toBeVisible();
  await page.locator(".editor-title-button").click();
  await page.locator(".editor-title-wrap input").fill("A".repeat(100));
  await page.keyboard.press("Enter");
  await expect(page.locator(".editor-title-button")).toHaveText("A".repeat(100));
  await expect(page.locator(".editor-title-button")).toHaveAttribute("title","A".repeat(100));
  await expect(page.locator(".editor-title-button")).toHaveCSS("-webkit-line-clamp","2");
  const editorTitleWidth=await page.locator(".editor-title-wrap").evaluate(node=>node.getBoundingClientRect().width);expect(editorTitleWidth).toBeLessThanOrEqual(621);
  await page.getByRole("button",{name:/Captions & context/i}).click();
  await expect(page.getByText(/OWNER-SUPPLIED CAPTIONS/i)).toBeVisible();
  const capsule={schema:"screennote.repro-capsule",version:1,createdAt:"2026-11-26T12:00:00.000Z",durationMs:1200,page:{url:"https://user:secret@example.com/checkout?session=private#payment",title:"Checkout",userAgent:"Playwright test browser",viewport:{width:390,height:844}},steps:[{atMs:250,action:"click",target:{tag:"button",role:"button",label:"Continue to payment"}},{atMs:900,action:"key",key:"Enter",target:{tag:"button",role:"button",label:"Pay"}}]};
  await page.locator('input[accept=".json,application/json"]').setInputFiles({name:"repro-capsule.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(capsule))});
  await expect(page.locator(".editor-status")).toContainText(/Repro Capsule imported locally/i);
  await expect(page.locator(".context-editor label").filter({hasText:"Page URL"}).locator("input")).toHaveValue("https://example.com/checkout");
  await expect(page.getByLabel("Reproduction steps")).toHaveValue(/Continue to payment/);
  await expect(page.getByLabel("Reproduction steps")).toHaveValue(/Press Enter/);
  await expect(page.getByLabel("Environment (optional)")).toHaveValue(/390×844 viewport/);

  await page.locator(".context-editor textarea").first().fill("WEBVTT\n\n00:00:00.100 --> 00:00:00.500\nOpening frame");
  await page.getByRole("button",{name:/Save context/i}).click();
  await expect(page.getByRole("status").filter({hasText:/Changes saved/i})).toBeVisible();
  const srtDownloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:/Export SRT/i}).click();
  expect((await srtDownloadPromise).suggestedFilename()).toMatch(/\.srt$/);
  await page.locator(".context-editor textarea").nth(1).fill("0:00 Introduction");
  const chapterDownloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:/Export chapters JSON/i}).click();
  expect((await chapterDownloadPromise).suggestedFilename()).toMatch(/chapters\.json$/);
  await page.getByRole("button",{name:/Edit & annotate/i}).click();
  await page.getByRole("button",{name:"Blur"}).click();
  const canvas=page.locator(".annotation-overlay");
  const rect=await canvas.boundingBox();
  if(rect) { await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.2);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.45,rect.y+rect.height*.4,{steps:4});await page.mouse.up(); }
  await expect(page.getByText(/1 marks on this video/i)).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(page.getByText(/0 marks on this video/i)).toBeVisible();
  if(rect) { await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.2);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.45,rect.y+rect.height*.4,{steps:4});await page.mouse.up(); }
  await expect(page.getByText(/1 marks on this video/i)).toBeVisible();
  await expect(page.getByRole("button",{name:"Jump to blur mark 1"})).toBeVisible();
  await page.getByRole("button",{name:"Delete mark 1"}).click();
  await expect(page.getByText(/0 marks on this video/i)).toBeVisible();
  if(rect) { await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.2);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.45,rect.y+rect.height*.4,{steps:4});await page.mouse.up(); }
  await expect(page.getByText(/1 marks on this video/i)).toBeVisible();
  const frameDownloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:/Capture annotated frame/i}).click();
  expect((await frameDownloadPromise).suggestedFilename()).toMatch(/-frame-\d+ms\.png$/);
  await expect(page.getByRole("status").filter({hasText:/Annotated frame saved as PNG/i})).toBeVisible();
  const editorVideo=page.locator(".editor-video-wrap video");
  const originalPlayhead=await editorVideo.evaluate(async node=>{const v=node as HTMLVideoElement;v.pause();const target=Math.min(.35,Math.max(.1,(v.duration||1)*.3));if(Math.abs(v.currentTime-target)>.02)await new Promise<void>(resolve=>{const done=()=>resolve();v.addEventListener("seeked",done,{once:true});v.currentTime=target;window.setTimeout(done,1500)});return target;});
  await page.getByRole("button",{name:/Export annotated copy/i}).click();
  await expect(page.getByRole("status").filter({hasText:/Annotated copy saved/i})).toBeVisible({timeout:30000});
  const restored=await editorVideo.evaluate(node=>({time:(node as HTMLVideoElement).currentTime,paused:(node as HTMLVideoElement).paused}));expect(restored.paused).toBe(true);expect(Math.abs(restored.time-originalPlayhead)).toBeLessThan(.1);
  await page.getByRole("button",{name:/Save all changes/i}).click();
  await expect(page.getByRole("status").filter({hasText:/Changes saved/i})).toBeVisible();
  const savedLongTitle=page.locator('.clip-card h3[title="'+ "A".repeat(100) +'"]');
  await expect(savedLongTitle).toBeVisible();
  await expect(savedLongTitle).toHaveCSS("-webkit-line-clamp","2");
  for(const width of [320,375,768,1120,1440]){await page.setViewportSize({width,height:900});await contained(page,width);if(width===320){const heights=await page.locator(".editor-toolbar button,.editor-tabs button").evaluateAll(nodes=>nodes.filter(node=>getComputedStyle(node).display!=="none").map(node=>node.getBoundingClientRect().height));expect(heights.length).toBeGreaterThan(0);expect(heights.every(height=>height>=44)).toBe(true);}if([320,1440].includes(width)){await page.screenshot({path:`test-results/screenshots/editor-${width}.png`,fullPage:true});await page.screenshot({path:`test-results/screenshots/editor-viewport-${width}.png`});}}
  for(const v of [{width:568,height:320},{width:844,height:390},{width:1024,height:600}]){await page.setViewportSize(v);await contained(page,v.width);await expect(page.getByRole("button",{name:"Close editor"})).toBeVisible();}
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole("button",{name:/Share a reviewed copy/i}).click();
  await expect(page.getByRole("heading",{name:"Make a temporary link"})).toBeVisible();
  const modalLayer=await page.locator(".modal-backdrop").evaluate(el=>Number(getComputedStyle(el).zIndex));
  const editorLayer=await page.locator(".editor-workspace").evaluate(el=>Number(getComputedStyle(el).zIndex));
  expect(modalLayer).toBeGreaterThan(editorLayer);
  await expect(page.getByText(/Only the new shared copy is uploaded/i)).toBeVisible();
  await page.locator(".review-brief-fields > summary").click({force:true});
  await expect(page.locator(".review-brief-fields")).toHaveJSProperty("open",true);
  await page.getByLabel("Review purpose").fill("Check the checkout flow");
  await page.getByLabel("Review focus areas").fill("Watch the payment confirmation step");
  await page.getByLabel("Expected outcome").fill("A successful payment shows a receipt");
  await page.getByLabel("Requested action").selectOption("approve");
  await expect(page.getByLabel("Requested action")).toHaveValue("approve");
  await page.getByRole("button",{name:"Close share settings"}).click();
  await page.getByRole("button",{name:"Close editor"}).click();
});

test("recording setup exposes quality, microphone and camera placement controls",async({page})=>{
  await page.goto("/");
  await page.locator("summary").filter({hasText:/Recording quality, microphone and camera settings/i}).click();
  await expect(page.getByLabel("Recording quality")).toBeVisible();
  await page.getByLabel("Recording quality").selectOption("clear");
  await expect(page.getByLabel("Recording quality")).toHaveValue("clear");
  await expect(page.getByLabel("Microphone source")).toBeVisible();
  await expect(page.getByLabel("Camera bubble size")).toBeVisible();
  await page.getByRole("checkbox",{name:"Camera bubble"}).check();
  await page.getByLabel("Camera bubble position").selectOption("top-left");
  await expect(page.getByLabel("Camera bubble position")).toHaveValue("top-left");
  await page.getByLabel("Camera bubble position").selectOption("custom");
  await expect(page.getByLabel("Camera bubble horizontal position")).toBeVisible();
  await page.getByLabel("Camera bubble horizontal position").fill("0.3");
  await expect(page.getByLabel("Camera bubble horizontal position")).toHaveValue("0.3");
  const stage=page.getByRole("group",{name:"16 by 9 screen preview"}),handle=page.getByRole("slider",{name:"Move camera bubble"});
  await expect(handle).toBeVisible();const before=await handle.getAttribute("aria-valuetext");
  await handle.focus();await handle.press("ArrowRight");await expect(handle).not.toHaveAttribute("aria-valuetext",before!);
  const stageBox=await stage.boundingBox(),handleBox=await handle.boundingBox();expect(stageBox&&handleBox).toBeTruthy();
  await page.mouse.move(handleBox!.x+handleBox!.width/2,handleBox!.y+handleBox!.height/2);await page.mouse.down();
  await page.mouse.move(stageBox!.x+stageBox!.width*.65+handleBox!.width/2,stageBox!.y+stageBox!.height*.45+handleBox!.height/2);await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuetext",/Horizontal 6[0-9]%, vertical 4[0-9]%/);
});
test("preferences export and restore a portable local library backup",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve("legacy/public/sample.webm"));
  await expect(page.getByRole("heading",{name:"sample"})).toBeVisible({timeout:15000});
  await page.getByRole("button",{name:"Open preferences"}).click();
  await assertNamedControls(page);
  const preferences=page.getByRole("dialog",{name:/Preferences & backups/i}),preferenceControls=preferences.locator('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]');
  await preferenceControls.last().focus();await page.keyboard.press("Tab");await expect(preferenceControls.first()).toBeFocused();
  await expect(page.getByRole("dialog",{name:/Preferences & backups/i})).toBeVisible();
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:/Back up my library/i}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe("screennote-library-backup.zip");
  const filePath=await download.path();
  if(!filePath)throw new Error("Backup download did not produce a file.");
  await page.locator('input[type="file"]').last().setInputFiles(filePath);
  await expect(page.getByRole("status").filter({hasText:/duplicate\(s\) were skipped/i})).toBeVisible();
  await page.getByRole("button",{name:/Close preferences/i}).click();
});
test("offline mode preserves local preview and editing while preventing publishing",async({page})=>{
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve("legacy/public/sample.webm"));
  await expect(page.getByRole("heading",{name:"sample"})).toBeVisible({timeout:15000});
  await page.context().setOffline(true);
  await expect(page.getByText(/Offline mode/i)).toBeVisible();
  await page.getByRole("button",{name:/Preview/i}).click();
  await expect(page.locator(".preview-workspace video")).toBeVisible();
  await page.getByRole("button",{name:/Open editor/i}).click();
  await expect(page.locator(".editor-workspace")).toBeVisible();
  await page.getByRole("button",{name:"Close editor"}).click();
  await page.getByRole("button",{name:/Share sample/i}).click();
  await expect(page.getByRole("status").filter({hasText:/Sharing needs an internet connection/i})).toBeVisible();
  await page.context().setOffline(false);
});
test("new frontend contains no legacy stylesheet or legacy app script requests",async({page})=>{
  const requested:string[]=[],fontRequests:string[]=[];
  page.on("request",request=>{const url=request.url();requested.push(new URL(url).pathname);if(/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(url))fontRequests.push(url)});
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  expect(requested).not.toContain("/style.css");
  expect(requested).not.toContain("/app.js");
  expect(requested).toContain("/src/main.tsx");
  expect(fontRequests,"the private workspace must not request third-party fonts").toEqual([]);
});


test("temporary share viewer and privacy route use the independent responsive design",async({page})=>{
  const token="a".repeat(40);
  await page.route(`**/api/share/${token}`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({title:"A product walkthrough",mimeType:"video/webm",size:2048,duration:38,expiresAt:Math.floor(Date.now()/1000)+86400,passwordRequired:false})}));
  await page.route(`**/api/share/${token}/comments`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({comments:[{id:"visual-comment-1",parentId:null,viewerLabel:"Guest reviewer",body:"Please clarify this frame.",time:0,createdAt:100,resolved:0,deletedAt:null,isMine:true,anchorX:null,anchorY:null},{id:"visual-comment-deleted",parentId:null,viewerLabel:"Guest reviewer",body:"deleted private feedback must not leak",time:3,createdAt:102,resolved:0,deletedAt:110,isMine:true,anchorX:null,anchorY:null}]})}));
  let savedReview:any=null;
  await page.route("**/api/share/"+token+"/reviews",async route=>{
    if(route.request().method()==="POST"){savedReview=route.request().postDataJSON();await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({saved:true})});return;}
    const mine=savedReview?{reviewerLabel:savedReview.reviewerLabel||"Guest",decision:savedReview.decision,comment:savedReview.comment,time:savedReview.time,createdAt:100,updatedAt:101}:null;
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({reviews:mine?[mine]:[],myReview:mine})});
  });
  let selectedReaction="";
  await page.route("**/api/share/"+token+"/reactions",async route=>{
    if(route.request().method()==="POST")selectedReaction=route.request().postDataJSON().reaction||"";
    const counts={like:selectedReaction==="like"?1:0,thanks:selectedReaction==="thanks"?1:0,idea:selectedReaction==="idea"?1:0};
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({counts,myReaction:selectedReaction})});
  });
  const ownerKey="a".repeat(64);
  await page.addInitScript(({token,ownerKey})=>localStorage.setItem("screennote-recovery-"+token,ownerKey),{token,ownerKey});
  let currentDetails:any={
    captions:[{start:1,end:2,text:"The first step"}],
    annotations:[{kind:"rectangle",x:.1,y:.1,w:.2,h:.2,time:10,duration:4},{kind:"redact",x:.3,y:.3,w:.2,h:.2}],
    chapters:[{time:1,title:"Introduction"}],
    report:{steps:"Open the menu",expected:"Menu opens",actual:"Menu remains closed",url:"",environment:""},
    reviewBrief:{purpose:"Review the checkout flow",focus:"Inspect the payment confirmation",expectedOutcome:"A receipt is shown",requestedAction:"approve"},
    reviewStatus:"approved",reviewVersion:{number:2,publishedAt:1764158400000}
  };
  await page.route("**/api/share/"+token+"/details",async route=>{
    if(route.request().method()==="PUT"){currentDetails=route.request().postDataJSON().details;await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({saved:true})});return;}
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({details:currentDetails})});
  });
  await page.goto("/s/"+token+"?campaign=private#review");
  await expect(page.getByRole("heading",{name:"A product walkthrough"})).toBeVisible();
  await expect(page.locator(".share-version-badge")).toHaveText("Version 2");
  await assertTextContrast(page,"guest share light");
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","dark"));
  await assertTextContrast(page,"guest share dark");
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","light"));
  await assertNamedControls(page);
  await expect(page.getByText("Approved",{exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"Review brief"})).toContainText("Review the checkout flow");
  await expect(page.getByRole("region",{name:"Review brief"})).toContainText("A receipt is shown");
  const reviewPanel=page.getByRole("region",{name:"Review decision"});
  await expect(reviewPanel).toBeVisible();
  await reviewPanel.getByRole("button",{name:"Needs changes"}).click();
  await page.getByLabel("Reviewer display name").fill("Luke");
  await page.getByLabel("Review note").fill("Please adjust the payment state.");
  await reviewPanel.getByRole("button",{name:"Save decision"}).click();
  await expect(reviewPanel.getByRole("status")).toContainText("saved");
  await expect(reviewPanel).toContainText("Please adjust the payment state.");
  await page.getByRole("button",{name:/Thanks/i}).click();
  await expect(page.getByRole("button",{name:/Thanks/i})).toHaveAttribute("aria-pressed","true");
  await reviewPanel.getByRole("button",{name:"Reopen review"}).click();
  await expect(page.getByText("Needs feedback",{exact:true})).toBeVisible();
  await reviewPanel.getByRole("button",{name:"Mark changes requested"}).click();
  await expect(page.getByText("Changes requested",{exact:true})).toBeVisible();
  const packetDownloadPromise=page.waitForEvent("download");
  await reviewPanel.getByRole("button",{name:"Download review packet"}).click();
  const packetDownload=await packetDownloadPromise;
  expect(packetDownload.suggestedFilename()).toBe("screennote-review-packet.md");
  const jsonDownloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export JSON"}).click();
  const jsonDownload=await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toBe("screennote-review-packet.json");
  const jsonPath=await jsonDownload.path();if(!jsonPath)throw new Error("Review packet JSON download did not produce a file.");
  const packet=JSON.parse(await readFile(jsonPath,"utf8"));
  expect(packet.schema).toBe("screennote.review-packet");
  expect(packet.shareUrl).toContain("/s/"+token);
  expect(packet.shareUrl).not.toContain("campaign=private");
  expect(packet.shareUrl).not.toContain("#review");
  expect(packet.guestDecisions).toContainEqual(expect.objectContaining({decision:"changes-requested",comment:"Please adjust the payment state.",reviewerLabel:"Luke"}));
  expect(packet.discussion).toContainEqual(expect.objectContaining({id:"visual-comment-deleted",text:"[Comment deleted]",deleted:true}));
  expect(JSON.stringify(packet)).not.toContain("deleted private feedback must not leak");
  const markdownDownloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export Markdown"}).click();
  const markdownDownload=await markdownDownloadPromise;
  expect(markdownDownload.suggestedFilename()).toBe("screennote-review-packet.md");
  const markdownPath=await markdownDownload.path();if(!markdownPath)throw new Error("Review packet Markdown download did not produce a file.");
  const markdown=await readFile(markdownPath,"utf8");
  expect(markdown).toContain("Review packet — A product walkthrough");
  expect(markdown).toContain("Review the checkout flow");
  expect(markdown).toContain("Please adjust the payment state.");
  expect(markdown).toContain("\\[Comment deleted\\]");
  expect(markdown).not.toContain("deleted private feedback must not leak");
  await expect(page.locator(".share-video-wrap")).toBeVisible();
  await expect(page.locator(".shared-annotation-overlay .shared-mark")).toHaveCount(1); // Only the untimed legacy mark is active at 0s.
  await expect(page.locator(".share-discussion")).toBeVisible();
  await expect(page.locator(".discussion-title h2")).toHaveText("1 comment");
  await expect(page.locator(".share-comment-actions")).toHaveCSS("display","flex");
  await expect(page.locator(".share-comment-actions button")).toHaveCount(4);
  await page.setViewportSize({width:320,height:900});
  const commentActionHeights=await page.locator(".share-comment-actions button").evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
  expect(commentActionHeights.every(height=>height>=44),"comment actions must have mobile-sized touch targets").toBe(true);
  const shareHeaderActionHeights=await page.locator(".share-header-actions .text-action").evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
  expect(shareHeaderActionHeights.length).toBeGreaterThanOrEqual(2);
  expect(shareHeaderActionHeights.every(height=>height>=44),"share header actions must have mobile-sized touch targets").toBe(true);
  const timestampHeight=await page.locator(".share-comment-meta .timestamp-link").first().evaluate(node=>node.getBoundingClientRect().height);
  expect(timestampHeight,"timestamp seek target must be comfortably tappable on mobile").toBeGreaterThanOrEqual(44);
  await expect(page.locator(".share-comment-meta .timestamp-link").first()).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
  await expect(page.locator(".share-comment-actions button").nth(0)).toHaveText("Reply");
  await expect(page.locator(".share-comment-actions button").nth(1)).toHaveText("Edit");
  await expect(page.locator(".share-comment-actions button").nth(2)).toHaveText("Delete");
  await expect(page.locator(".share-comment-actions button").nth(3)).toHaveText("Resolve");
  await expect(page.getByRole("button",{name:/Introduction/i})).toBeVisible();
  await expect(page.getByText(/SEARCH THE TRANSCRIPT/i)).toBeVisible();
  await expect(page.getByText(/Open the menu/i)).toBeVisible();
  for(const width of [320,375,768,1120,1440]){
    await page.setViewportSize({width,height:900});
    await contained(page,width);
    if([320,1440].includes(width))await page.screenshot({path:`test-results/screenshots/share-${width}.png`,fullPage:true});
  }
  await page.goto("/privacy");
  await expect(page.getByRole("heading",{name:"Your original stays with you."})).toBeVisible();
  await expect(page.locator(".privacy-document")).toBeVisible();
  for(const width of [320,1440]){await page.setViewportSize({width,height:900});await page.screenshot({path:`test-results/screenshots/privacy-${width}.png`,fullPage:true});}
});

test("password-protected share keeps the gate closed until correct unlock and remains responsive",async({page})=>{
  const token="d".repeat(40);let unlocked=false;
  await page.route("**/api/share/"+token,route=>route.fulfill({status:unlocked?200:401,contentType:"application/json",body:JSON.stringify(unlocked?{title:"Protected walkthrough",mimeType:"video/webm",size:2048,duration:12,expiresAt:Math.floor(Date.now()/1000)+86400,passwordRequired:true}:{error:"Enter the sharing password."})}));
  await page.route("**/api/share/"+token+"/access",async route=>{
    const password=route.request().postDataJSON()?.password;
    if(password!=="correct-share-password"){await route.fulfill({status:401,contentType:"application/json",body:JSON.stringify({error:"That password isn't correct."})});return;}
    unlocked=true;await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({access:true})});
  });
  await page.route("**/api/share/"+token+"/comments",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({comments:[]})}));
  await page.route("**/api/share/"+token+"/details",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({details:{}})}));
  await page.route("**/api/share/"+token+"/reactions",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({counts:{like:0,thanks:0,idea:0},myReaction:""})}));
  await page.route("**/api/share/"+token+"/reviews",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({reviews:[],myReview:null})}));
  await page.route("**/api/share/"+token+"/media",route=>route.fulfill({status:200,headers:{"content-type":"video/webm"},body:Buffer.from([0x1a,0x45,0xdf,0xa3])}));
  await page.goto("/s/"+token);
  await expect(page.getByRole("heading",{name:"This ScreenNote is private."})).toBeVisible();
  await assertNamedControls(page);
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});await contained(page,width);}
  for(const v of [{width:320,height:480},{width:568,height:320},{width:844,height:390}]){await page.setViewportSize(v);await contained(page,v.width);await expect(page.getByLabel("Password")).toBeVisible();}
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button",{name:"Unlock video"}).click();
  await expect(page.locator(".share-error")).toContainText("That password isn't correct.");
  await expect(page.getByRole("heading",{name:"This ScreenNote is private."})).toBeVisible();
  await page.getByLabel("Password").fill("correct-share-password");
  await page.getByRole("button",{name:"Unlock video"}).click();
  await expect(page.getByRole("heading",{name:"Protected walkthrough"})).toBeVisible();
  await expect(page.locator(".password-gate")).toHaveCount(0);
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});await contained(page,width);}
  for(const v of [{width:320,height:480},{width:568,height:320},{width:844,height:390}]){await page.setViewportSize(v);await contained(page,v.width);await expect(page.getByRole("heading",{name:"Protected walkthrough"})).toBeVisible();}
});

test("publishing new versions retains links only by consent and stop-sharing revokes all versions",async({page})=>{
  test.setTimeout(90000);
  let reservations=0,publishes=0;const tokens=["v1"+"a".repeat(38),"v2"+"b".repeat(38),"v3"+"c".repeat(38)];const revoked:string[]=[];
  await page.route("**/api/session",route=>route.fulfill({status:200,contentType:"application/json",body:"{}"}));
  await page.route("**/api/recordings",async route=>{
    if(route.request().method()!=="POST"){await route.continue();return;}
    reservations++;await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({id:"reservation-"+reservations,chunkBytes:2097152})});
  });
  await page.route("**/api/recordings/*/upload-state",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"ready",parts:[],chunkBytes:2097152})}));
  await page.route("**/api/recordings/*/publish",route=>{
    const index=publishes++;const token=tokens[index];
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({id:"share-id-"+(index+1),token,url:"/s/"+token,expiresAt:Math.floor(Date.now()/1000)+86400,passwordProtected:false})});
  });
  await page.route("**/api/share/*/details",route=>route.request().method()==="PUT"?route.fulfill({status:200,contentType:"application/json",body:"{}"}):route.continue());
  await page.route("**/api/share/*/manage",async route=>{
    if(route.request().method()!=="DELETE"){await route.continue();return;}
    const token=new URL(route.request().url()).pathname.split("/")[3];revoked.push(token);
    await route.fulfill({status:200,contentType:"application/json",body:"{}"});
  });
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve("legacy/public/sample.webm"));
  await expect(page.getByRole("heading",{name:"sample"})).toBeVisible({timeout:15000});
  await page.getByRole("button",{name:/Preview/i}).click();
  await page.getByRole("button",{name:"Share temporarily"}).click();
  await assertTextContrast(page,"publish first version dialog light");
  await page.getByRole("button",{name:"Publish temporary link"}).click();
  await expect(page.getByText("Version 1 link ready")).toBeVisible({timeout:20000});
  await page.locator(".share-link-toast").getByRole("button",{name:"Dismiss"}).click();
  await page.getByRole("button",{name:"Publish new version"}).click();
  await assertTextContrast(page,"publish version dialog light");
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","dark"));
  await assertTextContrast(page,"publish version dialog dark");
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","light"));
  await page.getByRole("checkbox",{name:/Keep previous share as a version/i}).check();
  await page.getByRole("button",{name:"Publish new version"}).last().click();
  await expect(page.getByText("Version 2 link ready")).toBeVisible({timeout:20000});
  await page.locator(".share-link-toast").getByRole("button",{name:"Dismiss"}).click();
  const history=page.getByRole("region",{name:"Previous share versions"});
  await expect(history).toContainText("Version 1");
  await assertTextContrast(page,"version history light");
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","dark"));
  await assertTextContrast(page,"version history dark");
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","light"));
  await expect(history.getByRole("link",{name:/Open/i})).toHaveAttribute("href","/s/"+tokens[0]);
  expect(revoked).not.toContain(tokens[0]);
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Revoke share version 1"}).click();
  await expect(history).toHaveCount(0);
  expect(revoked).toContain(tokens[0]);
  await page.getByRole("button",{name:"Publish new version"}).click();
  await page.getByRole("checkbox",{name:/Keep previous share as a version/i}).check();
  await page.getByRole("button",{name:"Publish new version"}).last().click();
  await expect(page.getByText("Version 3 link ready")).toBeVisible({timeout:20000});
  await page.locator(".share-link-toast").getByRole("button",{name:"Dismiss"}).click();
  await expect(page.getByRole("region",{name:"Previous share versions"})).toContainText("Version 2");
  await assertTextContrast(page,"version history after republish");
  await page.getByRole("button",{name:"Close preview"}).click();
  await page.getByRole("button",{name:"Stop sharing sample"}).click();
  await expect(page.getByRole("status").filter({hasText:/All shared versions/i})).toBeVisible();
  expect(new Set(revoked)).toEqual(new Set(tokens));
  await expect(page.getByRole("heading",{name:"sample"})).toBeVisible();
});

test("light and dark text tokens meet WCAG AA contrast",async({page})=>{
  await page.goto("/");
  const readRatios=()=>page.evaluate(()=>{
    const style=getComputedStyle(document.documentElement);
    const hex=(name:string)=>style.getPropertyValue(name).trim().replace("#","");
    const rgb=(value:string)=>{const h=value.length===3?value.split("").map(x=>x+x).join(""):value;return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)};
    const lum=(value:string)=>rgb(value).map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
    const ratio=(a:string,b:string)=>{const values=[lum(a),lum(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05)};
    const ink=hex("--ink"),muted=hex("--muted"),rust=hex("--rust"),paper=hex("--paper"),panel=hex("--panel"),acid=hex("--acid"),acidInk=hex("--acid-ink");
    return [ratio(ink,paper),ratio(muted,paper),ratio(muted,panel),ratio(rust,paper),ratio(rust,panel),ratio(acidInk,acid)];
  });
  for(const theme of ["light","dark"]){
    if(theme==="dark")await page.getByRole("button",{name:"Toggle appearance"}).click();
    const ratios=await readRatios();
    for(const value of ratios)expect(value,theme+" contrast ratio").toBeGreaterThanOrEqual(4.5);
  }
});


test("transient share and alert surfaces keep readable contrast in both themes",async({page})=>{
  await page.goto("/");
  await page.evaluate(()=>document.body.insertAdjacentHTML("beforeend",`
    <div class="share-link-toast"><div><strong>Share link ready</strong><span>https://example.test/share</span></div><button class="button secondary">Copy link</button></div>
    <p class="share-error">The share could not be published.</p>
    <span class="shared-review-status changes-requested">Changes requested</span>
    <div class="review-decision-options"><button aria-pressed="true">Selected review</button></div>
    <div class="editor-status">Saved</div>
    <div class="offline-banner">Offline</div>
    <div class="capture-unavailable">Capture unavailable</div>
    <button class="button danger">Delete</button>
    <span class="duration">0:45</span>
  `));
  const contrast=async(selector:string)=>page.locator(selector).evaluateAll(elements=>elements.map(el=>{
    const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
    const lum=(v:number[])=>.2126*v[0]+.7152*v[1]+.0722*v[2];
    const style=getComputedStyle(el);let bgColor=style.backgroundColor;
    if(bgColor==="transparent"||bgColor==="rgba(0, 0, 0, 0)"){let parent=el.parentElement;while(parent){const candidate=getComputedStyle(parent).backgroundColor;if(candidate!=="transparent"&&candidate!=="rgba(0, 0, 0, 0)"){bgColor=candidate;break;}parent=parent.parentElement;}}
    const fg=lum(rgb(style.color)),bg=lum(rgb(bgColor));
    return {ratio:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),color:style.color,background:bgColor,opacity:style.opacity,disabled:(el as HTMLButtonElement).disabled};
  }));
  for(const theme of ["light","dark"]){
    if(theme==="dark"){await page.getByRole("button",{name:"Toggle appearance"}).click();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");}
    for(const selector of [".share-link-toast",".share-link-toast span",".share-link-toast button",".share-error",".shared-review-status.changes-requested",".review-decision-options button[aria-pressed=true]",".editor-status",".offline-banner",".capture-unavailable",".button.danger",".duration",".capture-panel",".capture-panel .button.primary",".capture-panel .capture-advanced summary",".toggle-option",".button.danger",".duration"]){
      const ratios=await contrast(selector);
      expect(ratios.length,selector+" must exist in "+theme).toBeGreaterThan(0);
      expect(ratios.every(value=>value.ratio>=4.5),selector+" contrast in "+theme+": "+ratios.map(value=>value.ratio.toFixed(2)+" fg="+value.color+" bg="+value.background+" opacity="+value.opacity+" disabled="+value.disabled).join("; ")).toBe(true);
    }
  }
});
