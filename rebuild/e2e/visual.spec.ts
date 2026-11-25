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

test("imported recording can be previewed, trimmed and shared from the new workspace",async({page})=>{
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve("legacy/public/sample.webm"));
  await expect(page.getByRole("heading",{name:"sample"})).toBeVisible({timeout:15000});
  await page.getByRole("button",{name:/Play sample/i}).click();
  await expect(page.getByRole("dialog",{name:/sample/i})).toBeVisible();
  await expect(page.locator("video.preview-video")).toBeVisible();
  await page.getByRole("button",{name:/Share temporarily/i}).click();
  await expect(page.getByRole("heading",{name:"Make a temporary link"})).toBeVisible();
  await expect(page.getByText(/Only this shared copy is uploaded/i)).toBeVisible();
  await page.getByRole("button",{name:"Close share settings"}).click();
  await page.getByRole("button",{name:"Close preview"}).click();
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
