import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {feedbackSummary,feedbackLine,formatAgo} from '../lib/feedback.js';
import {filterRecordings} from '../lib/library.js';
import {dirtyLabels,guardCopy} from '../lib/unsaved.js';

const clip = (comments, extra = {}) => ({comments, discussionRevision: comments.length, reactions: {like: 2, thanks: 0, idea: 1}, ...extra});
const c = (id, over = {}) => ({id, name: 'G', text: 'hi', time: 1, createdAt: 1000, parentId: null, deleted: false, resolved: false, ...over});

test('feedback summary counts open threads, last reply and resolved state', () => {
  const a = c('a'), b = c('b', {parentId: 'a', createdAt: 2000}), d = c('d', {time: 5, createdAt: 3000, resolved: true});
  const s = feedbackSummary(clip([a, b, d]), {now: 1000 + 3600 * 1000});
  assert.equal(s.openThreads, 1);
  assert.equal(s.totalThreads, 2);
  assert.equal(s.allResolved, false);
  assert.equal(s.lastReplyAt, 3000);
  assert.equal(s.reactionTotal, 3);
  assert.ok(feedbackLine(s).includes('1 open thread'));
  const s2 = feedbackSummary(clip([c('x', {resolved: true})]));
  assert.equal(feedbackLine(s2), '✓ All threads resolved');
  assert.equal(feedbackLine(feedbackSummary(clip([]))), '');
});

test('feedback unseen replies use seen watermark timestamp', () => {
  const s = feedbackSummary(clip([c('a', {createdAt: 5000}), c('b', {createdAt: 9000})]), {seenAt: 6000});
  assert.equal(s.newReplies, 1);
  assert.ok(feedbackLine(s).startsWith('● 1 new reply'));
});

test('formatAgo is honest and bounded', () => {
  assert.equal(formatAgo(0), '');
  assert.equal(formatAgo(1000, 2000), 'just now');
  assert.equal(formatAgo(1000, 1000 + 3600 * 1000), '1 h ago');
});

test('derived open-threads filter uses fetched feedback, manual filter unchanged', () => {
  const clips = [{id: '1', title: 'A', reviewStatus: 'approved', createdAt: 1}, {id: '2', title: 'B', reviewStatus: 'needs-feedback', createdAt: 2}];
  const fb = {'1': {openThreads: 2}, '2': {openThreads: 0}};
  assert.deepEqual(filterRecordings(clips, {status: 'open-threads', feedbackById: fb}).map(x => x.id), ['1']);
  assert.deepEqual(filterRecordings(clips, {status: 'approved'}).map(x => x.id), ['1']);
});

test('unsaved guard names every dirty source in order', () => {
  assert.deepEqual(dirtyLabels({marks: true, title: true, password: true}), ['title', 'drawn marks', 'share password (not saved)']);
  assert.deepEqual(dirtyLabels({}), []);
  assert.ok(guardCopy(['title']).includes('title'));
});

test('trim is interruptible via AbortSignal and exposes progress UI', () => {
  const src = fs.readFileSync(new URL('../public/capture.js', import.meta.url), 'utf8');
  assert.ok(src.includes('options={}') && src.includes('signal') && src.includes('AbortError'));
  const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('id="trim-meter"') && app.includes('id="cancel-trim"') && app.includes('encodeController'));
  assert.ok(app.includes('data-action="cancel-trim"'));
});

test('guest composer does not pause or pin on focus and has a hint line', () => {
  const src = fs.readFileSync(new URL('../public/discussion-ui.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('input.onfocus'));
  assert.ok(src.includes('composer-hint') && src.includes('timestamp-chip'));
  assert.ok(src.includes('overlay.contains(document.activeElement)'));
});

test('library cards fetch feedback via owner-gated manage with no new endpoint', () => {
  const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("api('manage'") && app.includes('data-feedback'));
  assert.ok(!app.includes('setInterval') || app.indexOf('checkFeedback') < app.indexOf('setInterval'));
  const apiSrc = fs.readFileSync(new URL('../api/clip.js', import.meta.url), 'utf8');
  assert.ok(!apiSrc.includes('manage-summary'));
});
