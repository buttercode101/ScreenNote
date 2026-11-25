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
    const selectors="button,input,select,textarea,.clip-card,.clip-grid,.capture-panel,.preview-modal,.publish-modal,[role=dialog]";
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
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve("legacy/public/sample.webm"));
  await expect(page.getByRole("heading",{name:"sample"})).toBeVisible({timeout:15000});
  await expect(page.getByRole("button",{name:/Preview/i})).toBeVisible();
  await expect(page.getByRole("button",{name:/Edit/i})).toBeVisible();
  await page.getByRole("button",{name:/Preview/i}).click();
  await expect(page.locator(".preview-workspace")).toBeVisible();
  await expect(page.locator(".preview-workspace video")).toBeVisible();
  for(const width of [320,375,768,1120,1440]){await page.setViewportSize({width,height:900});const dims=await page.evaluate(()=>({body:document.body.scrollWidth,doc:document.documentElement.scrollWidth,viewport:innerWidth}));expect(dims.body).toBeLessThanOrEqual(width+1);expect(dims.doc).toBeLessThanOrEqual(width+1);if([320,1440].includes(width))await page.screenshot({path:`test-results/screenshots/preview-${width}.png`,fullPage:true});}
  await page.getByRole("button",{name:/Open editor/i}).click();
  await expect(page.locator(".editor-workspace")).toBeVisible();
  await expect(page.locator(".editor-video-wrap video")).toBeVisible();
  await page.getByRole("button",{name:/Captions & context/i}).click();
  await expect(page.getByText(/OWNER-SUPPLIED CAPTIONS/i)).toBeVisible();
  await page.locator(".context-editor textarea").first().fill("WEBVTT\n\n00:00:00.100 --> 00:00:00.500\nOpening frame");
  await page.getByRole("button",{name:/Save context/i}).click();
  await expect(page.getByRole("status").filter({hasText:/Changes saved/i})).toBeVisible();
  await page.getByRole("button",{name:/Edit & annotate/i}).click();
  await page.getByRole("button",{name:"Blur"}).click();
  const canvas=page.locator(".annotation-overlay");
  const rect=await canvas.boundingBox();
  if(rect) { await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.2);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.45,rect.y+rect.height*.4,{steps:4});await page.mouse.up(); }
  await expect(page.getByText(/1 marks on this video/i)).toBeVisible();
  await page.getByRole("button",{name:/Save all changes/i}).click();
  await expect(page.getByRole("status").filter({hasText:/Changes saved/i})).toBeVisible();
  for(const width of [320,375,768,1120,1440]){await page.setViewportSize({width,height:900});const dims=await page.evaluate(()=>({body:document.body.scrollWidth,doc:document.documentElement.scrollWidth,viewport:innerWidth}));expect(dims.body).toBeLessThanOrEqual(width+1);expect(dims.doc).toBeLessThanOrEqual(width+1);if([320,1440].includes(width))await page.screenshot({path:`test-results/screenshots/editor-${width}.png`,fullPage:true});}
  await page.getByRole("button",{name:/Share a reviewed copy/i}).click();
  await expect(page.getByRole("heading",{name:"Make a temporary link"})).toBeVisible();
  await expect(page.getByText(/Only this shared copy is uploaded/i)).toBeVisible();
  await page.getByRole("button",{name:"Close share settings"}).click();
  await page.getByRole("button",{name:"Close editor"}).click();
});

test("preferences export and restore a portable local library backup",async({page})=>{
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve("legacy/public/sample.webm"));
  await expect(page.getByRole("heading",{name:"sample"})).toBeVisible({timeout:15000});
  await page.getByRole("button",{name:/Preferences/i}).click();
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
  const requested:string[]=[];
  page.on("request",request=>requested.push(new URL(request.url()).pathname));
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  expect(requested).not.toContain("/style.css");
  expect(requested).not.toContain("/app.js");
  expect(requested).toContain("/src/main.tsx");
});


test("temporary share viewer and privacy route use the independent responsive design",async({page})=>{
  const token="a".repeat(40);
  await page.route(`**/api/share/${token}`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({title:"A product walkthrough",mimeType:"video/webm",size:2048,duration:38,expiresAt:Math.floor(Date.now()/1000)+86400,passwordRequired:false})}));
  await page.route(`**/api/share/${token}/comments`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({comments:[]})}));
  let selectedReaction="";
  await page.route("**/api/share/"+token+"/reactions",async route=>{
    if(route.request().method()==="POST")selectedReaction=route.request().postDataJSON().reaction||"";
    const counts={like:selectedReaction==="like"?1:0,thanks:selectedReaction==="thanks"?1:0,idea:selectedReaction==="idea"?1:0};
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({counts,myReaction:selectedReaction})});
  });
  await page.route("**/api/share/"+token+"/details",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({details:{
      captions:[{start:1,end:2,text:"The first step"}],
      chapters:[{time:1,title:"Introduction"}],
      report:{steps:"Open the menu",expected:"Menu opens",actual:"Menu remains closed",url:"",environment:""},
      reviewStatus:"approved"
    }})
  }));
  await page.goto("/s/"+token);
  await expect(page.getByRole("heading",{name:"A product walkthrough"})).toBeVisible();
  await expect(page.getByText("Approved",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:/Thanks/i}).click();
  await expect(page.getByRole("button",{name:/Thanks/i})).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".share-video-wrap")).toBeVisible();
  await expect(page.locator(".share-discussion")).toBeVisible();
  await expect(page.getByRole("button",{name:/Introduction/i})).toBeVisible();
  await expect(page.getByText(/SEARCH THE TRANSCRIPT/i)).toBeVisible();
  await expect(page.getByText(/Open the menu/i)).toBeVisible();
  for(const width of [320,375,768,1120,1440]){
    await page.setViewportSize({width,height:900});
    const dimensions=await page.evaluate(()=>({body:document.body.scrollWidth,doc:document.documentElement.scrollWidth,viewport:innerWidth}));
    expect(dimensions.body).toBeLessThanOrEqual(width+1);
    expect(dimensions.doc).toBeLessThanOrEqual(width+1);
    if([320,1440].includes(width))await page.screenshot({path:`test-results/screenshots/share-${width}.png`,fullPage:true});
  }
  await page.goto("/privacy");
  await expect(page.getByRole("heading",{name:"Your original stays with you."})).toBeVisible();
  await expect(page.locator(".privacy-document")).toBeVisible();
  for(const width of [320,1440]){await page.setViewportSize({width,height:900});await page.screenshot({path:`test-results/screenshots/privacy-${width}.png`,fullPage:true});}
});
