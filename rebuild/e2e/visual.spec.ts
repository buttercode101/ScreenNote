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

test.beforeAll(async()=>{await mkdir("test-results/screenshots",{recursive:true});});

test("independent React workspace is contained at 13 widths in light and dark",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1,name:/Make it clear/i})).toBeVisible();
  await expect(page.locator('script[type="module"][src="/src/main.tsx"]')).toHaveCount(1);
  await expect(page.locator("#app")).toHaveCount(0);
  for(const v of viewports){
    await page.setViewportSize({width:v.width,height:v.height});
    await contained(page,v.width);
    if([320,375,768,1120,1440].includes(v.width))await page.screenshot({path:`test-results/screenshots/${v.name}-light.png`,fullPage:true});
  }
  await page.getByRole("button",{name:"Toggle appearance"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await expect(page.locator(".capture-panel")).toHaveCSS("background-color","rgb(32, 33, 30)");
  for(const v of viewports){
    await page.setViewportSize({width:v.width,height:v.height});
    await contained(page,v.width);
    if([320,375,768,1120,1440].includes(v.width))await page.screenshot({path:`test-results/screenshots/${v.name}-dark.png`,fullPage:true});
  }
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
  await expect(page.locator(".preview-workspace video")).toBeVisible();
  await assertNamedControls(page);
  const previewDialog=page.locator(".preview-workspace"),previewButtons=previewDialog.locator("button");
  await previewButtons.first().focus();await page.keyboard.press("Shift+Tab");await expect(previewButtons.last()).toBeFocused();await page.keyboard.press("Tab");await expect(previewButtons.first()).toBeFocused();
  for(const width of [320,375,768,1120,1440]){await page.setViewportSize({width,height:900});await contained(page,width);if([320,1440].includes(width))await page.screenshot({path:`test-results/screenshots/preview-${width}.png`,fullPage:true});}
  await page.getByRole("button",{name:/Open editor/i}).click();
  await expect(page.locator(".editor-workspace")).toBeVisible();
  await assertNamedControls(page);
  await expect(page.locator(".editor-video-wrap video")).toBeVisible();
  await page.locator(".editor-title-button").click();
  await page.locator(".editor-title-wrap input").fill("A".repeat(100));
  await page.keyboard.press("Enter");
  await expect(page.locator(".editor-title-button")).toHaveText("A".repeat(100));
  await page.getByRole("button",{name:/Captions & context/i}).click();
  await expect(page.getByText(/OWNER-SUPPLIED CAPTIONS/i)).toBeVisible();
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
  for(const width of [320,375,768,1120,1440]){await page.setViewportSize({width,height:900});await contained(page,width);if(width===320){const heights=await page.locator(".editor-toolbar button,.editor-tabs button").evaluateAll(nodes=>nodes.filter(node=>getComputedStyle(node).display!=="none").map(node=>node.getBoundingClientRect().height));expect(heights.length).toBeGreaterThan(0);expect(heights.every(height=>height>=44)).toBe(true);}if([320,1440].includes(width))await page.screenshot({path:`test-results/screenshots/editor-${width}.png`,fullPage:true});}
  await page.getByRole("button",{name:/Share a reviewed copy/i}).click();
  await expect(page.getByRole("heading",{name:"Make a temporary link"})).toBeVisible();
  const modalLayer=await page.locator(".modal-backdrop").evaluate(el=>Number(getComputedStyle(el).zIndex));
  const editorLayer=await page.locator(".editor-workspace").evaluate(el=>Number(getComputedStyle(el).zIndex));
  expect(modalLayer).toBeGreaterThan(editorLayer);
  await expect(page.getByText(/Only this shared copy is uploaded/i)).toBeVisible();
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
  await page.route(`**/api/share/${token}/comments`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({comments:[]})}));
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
    reviewStatus:"approved"
  };
  await page.route("**/api/share/"+token+"/details",async route=>{
    if(route.request().method()==="PUT"){currentDetails=route.request().postDataJSON().details;await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({saved:true})});return;}
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({details:currentDetails})});
  });
  await page.goto("/s/"+token);
  await expect(page.getByRole("heading",{name:"A product walkthrough"})).toBeVisible();
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
  await expect(page.locator(".share-video-wrap")).toBeVisible();
  await expect(page.locator(".shared-annotation-overlay .shared-mark")).toHaveCount(1); // Only the untimed legacy mark is active at 0s.
  await expect(page.locator(".share-discussion")).toBeVisible();
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
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button",{name:"Unlock video"}).click();
  await expect(page.locator(".share-error")).toContainText("That password isn't correct.");
  await expect(page.getByRole("heading",{name:"This ScreenNote is private."})).toBeVisible();
  await page.getByLabel("Password").fill("correct-share-password");
  await page.getByRole("button",{name:"Unlock video"}).click();
  await expect(page.getByRole("heading",{name:"Protected walkthrough"})).toBeVisible();
  await expect(page.locator(".password-gate")).toHaveCount(0);
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});await contained(page,width);}
});
