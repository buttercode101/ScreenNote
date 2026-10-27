import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {shareOptions} from '../lib/share-options.js';
import {sharingProblem} from '../lib/recording-policy.js';
import {validTitle} from '../lib/titles.js';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const publish=source.slice(source.indexOf('async function publish()'),source.indexOf('function saveFile('));
function context({password='short',diskFailure=false}={}){
 const selected={id:'local-recording',title:'Saved title',blob:{size:1000},type:'video/webm',duration:7};
 const fields={'#recording-title-input':{value:'A new unsaved title'},'#link-days':{value:'7'},'#share-password':{value:password},'[data-action=publish]':{disabled:false},'#cancel-upload':{},'#upload-meter':{},'#upload-progress':{}};
 const ctx=vm.createContext({selected,validTitle,shareOptions,sharingProblem,AbortController,uploadController:null,health:true,busy:false,$:s=>fields[s],db:{put:async()=>{throw Error('Device storage is full')}},editor:()=>{throw Error('Must preserve the editor field on local save failure')}});
 vm.runInContext(publish,ctx);return{ctx,selected,fields};
}
test('invalid publish settings cannot mark an unsaved title as saved',async()=>{
 const{ctx,selected,fields}=context();await assert.rejects(vm.runInContext('publish()',ctx),/sharing password/);
 assert.equal(selected.title,'Saved title');assert.equal(fields['#recording-title-input'].value,'A new unsaved title');assert.equal(ctx.busy,false);
});
test('local persistence failure preserves the saved identity and edited title',async()=>{
 const{ctx,selected,fields}=context({password:'',diskFailure:true});await assert.rejects(vm.runInContext('publish()',ctx),/Device storage is full/);
 assert.equal(ctx.selected,selected);assert.equal(selected.title,'Saved title');assert.equal(selected.uploadAttempted,undefined);assert.equal(fields['#recording-title-input'].value,'A new unsaved title');assert.equal(ctx.busy,false);assert.equal(fields['[data-action=publish]'].disabled,false);
});
