import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {dirtyLabels,guardCopy} from '../lib/unsaved.js';

test('recording navigation can cancel an unsaved title without discarding its field', async () => {
  const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  // confirm() must be gone from the leave path
  assert.ok(!source.includes("confirm('Leave this recording"));
  assert.ok(source.includes('showUnsavedGuard'));
  const start = source.indexOf('function unsavedChanges()');
  const end = source.indexOf('function showUnsavedGuard', start);
  const field = { value: 'A title still being edited' };
  const context = vm.createContext({
    selected: { title: 'Saved title', duration: 10, reviewStatus: 'needs-feedback' },
    $: s => s === '#recording-title-input' ? field : null,
    isGeneratedTitle: () => false,
    captionsVTT: () => '', formatTime: n => String(n),
    editorMarks: null,
    dirtyLabels, guardCopy,
  });
  vm.runInContext(source.slice(start, end), context);
  // dirty title is named, field untouched
  assert.deepEqual(vm.runInContext('unsavedChanges()', context), ['title']);
  assert.equal(field.value, 'A title still being edited');
  field.value = 'Saved title';
  assert.deepEqual(vm.runInContext('unsavedChanges()', context), []);
  // password flag is named as not-saved and never persisted: guard copy/labels carry no secret
  assert.deepEqual(dirtyLabels({password: true}), ['share password (not saved)']);
  assert.ok(guardCopy(['title']).includes('title'));
  assert.ok(!JSON.stringify(dirtyLabels({password: true})).includes('secret'));
});
