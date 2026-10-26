# ScreenNote contextual conversations — 26 October 2026

Mission: let a creator or guest continue any conversation at the right video moment, with readable mobile threads and optional playback previews. Preserve free, account-free sharing and existing recordings.

## Current primary-source research

Sources retrieved 26 October 2026. These are documented capabilities, not claims of hands-on access to competitors' paid editors.

| Product and source | Observed pattern | ScreenNote decision |
|---|---|---|
| [Loom comments and reactions](https://support.atlassian.com/loom/docs/react-to-videos-with-emojis-and-in-video-comments) | Timeline reactions, expandable comments, text/emoji replies, video replies, comment following | Threads, timeline entry points and playback bubbles; no paid transcription or account-dependent notifications |
| [Frame.io commenting, updated 9 September 2026](https://help.frame.io/en/articles/9105251-commenting-on-your-media) | Frame-specific comments, range comments, spatial anchors, visibility controls | Fix the moment while composing; optional bubble visibility. Defer spatial pins and range selection until real usage justifies the extra editor UI |
| [Vimeo Review, 22 April 2026](https://vimeo.com/blog/post/simplified-vimeo-review) | Removes login walls, requires timestamps, reduces setup clicks, speeds comment access | Keep guest participation, inherit thread timestamp, individual comment links, compact composer |
| [Wistia comments, updated 21 September 2026](https://support.wistia.com/en/articles/8380934-team-and-audience-comments) | Anonymous audience feedback, edit/delete, resolve/reopen, timestamps | Browser-authorized editing/removal, creator moderation, thread resolution and filters |

The proposed improvement is a design hypothesis, not an independently measured competitive advantage: one calm bubble at a time rather than moving comments across the video; exact reply ancestry without progressively narrower mobile columns; private browser capabilities rather than treating a display name as identity.

## Implementation and acceptance

- Additive fields in existing JSON metadata: parentId, authorHash (private), creator (server verified), editedAt, deleted, resolved, discussionRevision. No schema migration or paid service.
- Any participant can reply to roots or replies, including their own. Parent must exist in the same available clip. Replies inherit the original moment. New replies reopen resolved threads.
- Shallow visual threads retain the exact parent reference. Collapse long threads; filter open/resolved; sort by moment or creation time.
- Own comments can be edited with optimistic conflict checks. Authors and the clip creator can remove comments; tombstones preserve replies. Root authors and the clip creator can resolve/reopen threads. Legacy comments remain readable/replyable; they cannot retroactively gain an anonymous edit capability.
- Author capability stored per clip in this browser; only its hash is saved server-side and it is never returned by public API. Creator key stays local and is checked server-side. Public names remain unverified. Clearing browser data loses anonymous edit access.
- One optional, static playback bubble previews a thread's latest visible reply at the root moment, for five video seconds. Simultaneous threads can be cycled; dismiss/hide works without hiding the thread list. Timeline markers group dense nearby roots. Tapping opens the exact comment and pauses. All text is escaped.
- HTML bubbles belong to the inline player. Native video fullscreen and picture-in-picture show the video; their external surfaces do not render HTML comments. No burned-in comments or new video encode is implied.
- Drafts remain in the tab's session storage across reload/manual refresh, including fixed timestamp/parent. Refresh does not clear composer text. No continuous polling, outbound notifications or mention identities are invented.
- Existing 100-total-comments-per-clip bound remains. Entries include replies and tombstones. Text remains 500 characters; names 40. These bounds protect metadata on the free plan.

## Validation

Local regression suite and browser/live acceptance are recorded after implementation. Synthetic clips and comments are used for testing; original user media must remain unchanged. Production must match the tested source fingerprint, and all disposable cloud uploads must be removed after acceptance.

### Acceptance evidence before final release

- 101 automated tests pass with zero failures/skips, including backward compatibility, all-parent replies, capabilities, optimistic edit conflicts, password/cross-clip denial, deletion preserving children, revision ordering and deterministic bubble/timeline selection.
- Public production API: actual synthetic WebM upload/publication; nested reply inherited its parent's time; creator badge checked by server; wrong-author edit rejected 403, missing parent rejected 409, stale edit rejected 409; public responses omit author/owner secrets.
- Chrome live browser at 1348 × 926: guest replied under a creator reply; replied to their own reply; edited the reply; created and resolved a second root; filtered to resolved; reply reopened the thread. A reply draft and parent survived both manual refresh and full page reload. Comment link copied and opened in a fresh tab, selected the exact comment, expanded the thread and sought to 1 second. Bubble cycling and hiding worked; hiding preserved the conversation list. No horizontal document overflow at this tested width.
- A seek test exposed a timing issue: bubbles waited for media `seeked` data readiness. The final change synchronizes the bubble immediately when a timeline item changes currentTime. This is separate from renewing an expired five-minute signed media URL; manual refresh renewed playback and retained the draft.
- Responsive CSS and touch marker grouping implemented, but **phone/tablet rendered checks remain unverified in this session**. The responsive synthetic preview was blocked by deployment protection; automatic approval rejected opening a temporary Vercel share link. That link was revoked. Production protection settings and frame-ancestor policy remain unchanged. No alternate route was used to access that protected preview.
- Native-device camera/microphone recording, physical phones and competitor paid editors were not tested in this feature task. No claim of flawless behaviour on every device is made.

Final source fingerprint, live checks and disposable-upload cleanup are reconciled after the last code patch. The synthetic live clip is not a retained product example.

### Final reconciliation

- Production code commit: `6e11e1376746c68589f584dd041f45d4a30567e4`, deployment `dpl_GN53qvrAzwCfpdcvU9VKtoPiBHSB`, canonical `https://screennote-woad.vercel.app/`, version 0.4.0. Local and downloaded release manifests matched exactly: `6185cdf41fe982a627ef3e043dd9fa19572442b69ec7d29cb9dbbf961c168811`. Both GitHub workflow runs succeeded.
- Final timeline-jump fix retested through the public browser: bubble immediately visible after choosing the 1-second timeline group; latest reply, cycle/hide and exact deep-link selection observed. [Live desktop screenshot](conversations-live-2026-10-26.jpg) is synthetic acceptance data, not a user recording.
- Separate protected synthetic video: password required on comment/edit/remove/resolve; cross-clip parent rejected; client-supplied creator flag ignored; removal erased the root body and preserved the child in a subsequent real database-backed view. Its upload was cleaned in `finally`.
- Main browser-created conversation read back through the public API: 6 comments, 2 roots, 4 replies, revision 9, edited browser text persisted. Main disposable upload deleted; viewer then returned 404. Capacity returned exactly to baseline: 1 recording, 10,704,790 reserved bytes, 989,295,210 available bytes. Original user media remains outside test mutation scope.
- Runtime error scan for the release showed expected negative-test 404/409 responses and a Node 24 dependency/platform `url.parse()` deprecation warning; no unexpected feature failure was observed in these checked flows. This is a scoped result, not a guarantee of absence of all errors.
- Documentation/screenshot evidence can be committed after the code acceptance without changing the application source fingerprint. Phone/tablet rendered verification remains pending protected-preview access approval.

Verdict: **READY WITH KNOWN LIMITATIONS** for the desktop/API flows above. Mobile/tablet rendering is explicitly unverified, and native fullscreen/PiP cannot display the HTML comment overlay.
