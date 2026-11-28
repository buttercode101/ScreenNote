import { describe,expect,it } from "vitest";
import { readFile } from "node:fs/promises";
const base=new URL("../extension/",import.meta.url);
const read=(name:string)=>readFile(new URL(name,base),"utf8");
describe("Repro Capsule extension privacy boundary",()=>{
 it("uses only the temporary active-tab and scripting permissions",async()=>{
  const manifest=JSON.parse(await read("manifest.json"));
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions.sort()).toEqual(["activeTab","scripting"]);
  expect(manifest.host_permissions).toBeUndefined();
 });
 it("does not transmit data and ignores form fields and typed values",async()=>{
  const capture=await read("capture.js");
  expect(capture).toContain('document.addEventListener("click",click,true)');
  expect(capture).toContain('document.addEventListener("keydown",key,true)');
  expect(capture).toContain('input,textarea,select,[contenteditable=true]');
  expect(capture).not.toMatch(/fetch\s*\(|XMLHttpRequest|sendBeacon|chrome\.storage/);
  expect(capture).not.toContain("event.target.value");
  expect(capture).toContain('u.search="";u.hash=""');
  expect(capture).toContain("packet.steps.length<500");
 });
 it("requires explicit start/stop and exposes review-before-export copy",async()=>{
  const capture=await read("capture.js"),popup=await read("popup.html"),logic=await read("popup.js");
  expect(capture).toContain("function start()");
  expect(capture).toContain("function stop()");
  expect(popup).toContain("Start capture");
  expect(popup).toContain("Stop &amp; review");
  expect(popup).toContain("Review and redact the capsule JSON");
  expect(logic).toContain("Review and redact the capsule JSON");
  expect(logic).toContain("Nothing has been uploaded");
 });
});
