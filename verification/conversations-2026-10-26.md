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
