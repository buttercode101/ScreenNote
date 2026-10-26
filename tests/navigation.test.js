import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('recording navigation can cancel an unsaved title without discarding its field', () => {
  const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('function unsavedTitle()');
  const end = source.indexOf('function home()', start);
  const field = { value: 'A title still being edited' };
  let prompts = 0;
  const context = vm.createContext({
    selected: { title: 'Saved title' }, $: () => field,
    isGeneratedTitle: () => false,
    confirm: () => { prompts++; return false; },
  });
  vm.runInContext(source.slice(start, end), context);
  assert.equal(vm.runInContext('confirmEditorLeave()', context), false);
  assert.equal(field.value, 'A title still being edited');
  assert.equal(prompts, 1);
  context.confirm = () => true;
  assert.equal(vm.runInContext('confirmEditorLeave()', context), true);
  field.value = 'Saved title';
  context.confirm = () => { throw Error('Saved titles should not prompt'); };
  assert.equal(vm.runInContext('confirmEditorLeave()', context), true);
});
