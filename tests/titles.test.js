import test from 'node:test';
import assert from 'node:assert/strict';
import {importTitle, validTitle, isGeneratedTitle} from '../lib/titles.js';

test('generated filenames get readable titles while original human titles survive', () => {
  assert.equal(importTitle('f84e7cf4-4f8a-493e-a654-98c85e705a88-1_all_463.mp4'), 'Untitled recording');
  assert.equal(importTitle('ffee1234ffee1234ffee1234ffee1234.webm'), 'Untitled recording');
  assert.equal(importTitle('Kitchen walkthrough.mp4'), 'Kitchen walkthrough');
  assert.equal(importTitle('recording.mp4', 'Weekly update'), 'Weekly update');
  assert.equal(isGeneratedTitle('Project 2026-10-26'), false);
  assert.equal(validTitle('  Menu feedback  '), 'Menu feedback');
  assert.throws(() => validTitle('   '));
  assert.throws(() => validTitle('x'.repeat(101)));
});
