import {describe,expect,it} from "vitest";
import {planShareVersion} from "../src/shareVersions";
import type {ShareVersion} from "../src/library";
const current={recordingId:"r1",token:"current-token",url:"https://example.test/s/current",ownerKey:"a".repeat(64),expiresAt:2000};
const prior=(version:number,token:string):ShareVersion=>({...current,version,token,publishedAt:1000,title:"Walkthrough"});
describe("safe share version publishing",()=>{
 it("starts at version one and increments without losing existing history",()=>{
  expect(planShareVersion(undefined,[],false,1000,"Clip")).toMatchObject({version:1,history:[],previousToRevoke:null});
  expect(planShareVersion({...current,version:2},[prior(1,"v1")],false,1000,"Clip")).toMatchObject({version:3,history:[prior(1,"v1")],previousToRevoke:current});
 });
 it("keeps an active previous link only when explicitly requested",()=>{
  const plan=planShareVersion({...current,version:1},[],true,1000,"Clip");
  expect(plan.version).toBe(2);expect(plan.previousToRevoke).toBeNull();expect(plan.previousKept).toMatchObject({version:1,token:"current-token",title:"Clip"});expect(plan.history).toHaveLength(1);
  expect(planShareVersion({...current,version:1},[],false,1000,"Clip").previousToRevoke).toEqual({...current,version:1});
 });
 it("never preserves expired links and caps history at ten unique versions",()=>{
  expect(planShareVersion({...current,expiresAt:900},[],true,1000000,"Clip").previousToRevoke).toBeTruthy();
  const history=Array.from({length:10},(_,i)=>prior(10-i,"v"+(10-i)));
  const plan=planShareVersion({...current,version:11},history,true,1000,"Clip");
  expect(plan.history).toHaveLength(10);expect(new Set(plan.history.map(v=>v.token)).size).toBe(10);expect(plan.history[0].version).toBe(11);expect(plan.historyToRevoke.map(v=>v.version)).toEqual([1]);
 });
});
