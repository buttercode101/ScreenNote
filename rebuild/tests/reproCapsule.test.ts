import { describe,expect,it } from "vitest";
import { formatReproCapsuleSteps,parseReproCapsule } from "../src/reproCapsule";
const valid=()=>({schema:"screennote.repro-capsule",version:1,createdAt:"2026-11-26T12:00:00.000Z",durationMs:2500,page:{url:"https://user:secret@example.com/path?token=private#section",title:"Checkout",userAgent:"Test browser",viewport:{width:390,height:844}},steps:[{atMs:250,action:"click",target:{tag:"button",role:"button",label:"Continue"}},{atMs:1250,action:"key",key:"Enter",target:{tag:"button"}}]});
describe("Repro Capsule import",()=>{
 it("sanitizes credentials, query and fragment and formats readable steps",()=>{
  const capsule=parseReproCapsule(valid());
  expect(capsule.page.url).toBe("https://example.com/path");
  expect(capsule.page.url).not.toContain("private");
  expect(formatReproCapsuleSteps(capsule)).toContain("[00:00.250] Click “Continue” (button · BUTTON)");
  expect(formatReproCapsuleSteps(capsule)).toContain("[00:01.250] Press Enter");
 });
 it("rejects unsupported schema, unsafe protocols and invalid key events",()=>{
  expect(()=>parseReproCapsule({...valid(),version:2})).toThrow(/supported/i);
  expect(()=>parseReproCapsule({...valid(),page:{...valid().page,url:"javascript:alert(1)"}})).toThrow(/HTTP/i);
  expect(()=>parseReproCapsule({...valid(),steps:[{atMs:2,action:"key",key:"a",target:{}}]})).toThrow(/unsupported key/i);
 });
 it("rejects oversized or out-of-range step lists and times",()=>{
  expect(()=>parseReproCapsule({...valid(),steps:Array.from({length:501},()=>valid().steps[0])})).toThrow(/500 steps/i);
  expect(()=>parseReproCapsule({...valid(),steps:[{atMs:3000,action:"click",target:{}}]})).toThrow(/invalid time/i);
 });
});
