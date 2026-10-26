# ScreenNote v0.3.2 — fixes and executed verification

26 October 2026 · South Africa

## Release identity

Code release: `24ac801ef04622408ada21c344bd7be0fa964e7c` in buttercode101/ScreenNote. Production code deployment: `dpl_FM1vJdsCndArN5vdtA6HRFyAGSv2`, READY, serving https://screennote-woad.vercel.app/. A later documentation-only commit may carry this record without changing the application fingerprint.

Version: **0.3.2**. Exact clean build/live release fingerprint: `5e9ce1cc1bb853e85243db88bff2beebcd8aa6a706e1008aae0af44f8c6771f0`. The entire clean local release manifest equals the downloaded production manifest. Production QA page `/matrix.html` returns 404; clean builds exclude fixture scripts and QA media. Production retains its original frame-ancestors policy; only the separate protected QA preview allowed same-origin frames for measurements.

## Seven findings closed

| Finding | Implemented correction | Executed acceptance |
| --- | --- | --- |
| Generated filenames become titles | Readable defaults on import, original filename kept separately, legacy generated names displayed safely | Imported an actual synthetic MP4 using the exact problematic filename through production UI; title became Untitled recording |
| Oversized mobile heading | Dedicated recording heading specificity; compact back navigation | Final editor measured 26px at 320–480px, with no horizontal overflow |
| Square/portrait video in forced landscape player | Player follows intrinsic metadata, with viewport height constraints | Square editor ratio exactly 1 across nine widths; portrait viewer ratio approximately 0.5625 across eight widths; original user's 1080-square clip rendered square and played to end |
| Publishing buried after tools | DOM and visual order: preview → sharing → collapsed optional tools | Inspected actual DOM order and rendered phone layout; expanded and successfully used Trim |
| Published titles locked | Validated owner-only title endpoint and editable title field | Corrected published title through production UI; same link showed new title. Real API checks retained replies/reactions and denied incorrect owner |
| Signature-only media accepted | Bounded trusted download and container/track/packet/duration validation | Eight-byte MP4 rejected with 400; viewer unavailable. Real MP4 and browser-generated WebM published and downloaded byte-identically |
| Diagnostic report says 0.2.0 | Version comes from application package metadata | Downloaded actual report from UI; JSON version is 0.3.2 |

Meaningful titles containing an ID are preserved. Interrupted verification downloads fail as retryable 503 responses. The validator checks media structure and packets; it does not claim universal codec decoding or support in every browser.

## Tests, build and CI

- 81/81 automated tests passed on the final application source, exit 0; no skipped or cancelled tests.
- Tests include generated/human titles, real square/portrait MP4 and WebM, invalid/truncated/audio-only media, dishonest duration, download bounds, interrupted verification streams, title authorization and feedback preservation, plus existing capture/storage/API regressions.
- Build and whitespace checks pass. npm audit reports zero known vulnerabilities; this is not a comprehensive security certification.
- GitHub Verify ScreenNote completed successfully for the code release: https://github.com/buttercode101/ScreenNote/actions/runs/40275471141.

## Actual browser execution

Protected preview used real IndexedDB, actual media elements and actual MediaRecorder trimming with simulated sharing/device fixtures clearly identified as such. It was not a physical phone.

Square editor widths: **320, 360, 390, 480, 768, 834, 1024, 1600, 1920 CSS pixels**. At every width, scroll width equalled client width, displayed square ratio was 1, and sharing preceded editing tools. Scrollbar width accounts for the 15px difference between iframe width and document client width.

Portrait viewer widths: **320, 390, 480, 768, 834, 1024, 1600, 1920 CSS pixels**. No horizontal overflow. Source ratio 270/480 and displayed ratio 0.5625, with only normal fractional-pixel rounding at 320px. A stress title and long reply also wrapped without horizontal overflow. Literal script-like reply text rendered as text with zero embedded script elements, and the submit button recovered.

Trimming a two-second square MP4 from 0.5–1.5 seconds created a new local copy. Reopening the same isolated storage namespace in a separate full-page tab recovered both original and trimmed recordings. The actual trimmed download is 18,188 bytes, 1.000 seconds, VP8 360×360 with Opus stereo 48kHz. Audio measured mean -21.2 dB and peak -17.4 dB. The existing nonfatal WebM unknown-sized-element warning remains; playback and decode succeeded. Universal decoder compatibility is not claimed.

Production UI was independently used to import a real synthetic MP4, save its title, choose one-day expiry, publish, edit the published title, open the same recipient link and play to ended=true at two seconds. The source name was the user's problematic generated filename; the media content was synthetic. This did not upload or alter a user video.

The user's existing shared recording independently loaded as 1080×1080, duration 8.8 seconds, rendered approximately 608.39×608.39 CSS pixels in the inspected desktop viewport, and played to ended=true with no media error. Its underlying title/data were not rewritten; generated-title display uses a readable fallback until the owner chooses a title.

## Actual service acceptance

Separate runs against the protected preview and the canonical production origin both passed:

1. Unprotected square MP4: reserve, upload, publish, wrong-owner title denial, exact-byte download, duplicate-safe reply, reaction, title correction preserving feedback, invalid-title rejection, revoke, view denial, delete and cleanup confirmation.
2. Password-protected real browser-trimmed WebM: the same flow, with wrong-password denial and authorized playback.
3. Signature-only invalid MP4: upload accepted into a private pending reservation; publication rejected with 400; viewer returned 404; owner deletion cleaned it up.

Original/download SHA-256 values:

- Square MP4: `2bfb54b7168df0110812adcbaf918ec9d126b4420d2854120b57ee72127a3dd1`.
- Browser-trimmed WebM: `90e1e604514f6a5992242b058ff05ec4d21329d6ba92ee702da7aff0c2c81086`.

The production scenario run completed on 26 October 2026 at 05:47:04 UTC. These tests traversed the actual Vercel API, authenticated Supabase gateway, database and private media storage. They are separate from simulated unit/UI fixture passes. Inspected runtime errors corresponded to deliberate negative tests, not established unhandled application failures.

## Cleanup and permissions

All six API-run synthetic uploads across preview and production reached deleted/cleanupComplete state. The normal application retains their metadata tombstones. A separate synthetic UI-only clip, id `02816d14-4ae1-4a55-8c2c-4e5fd0369a96`, is revoked and cannot be newly viewed. Its 13,788-byte private uploaded file and local copy remain pending permanent cleanup confirmation. The original user's recording remains published.

Automatic review rejected an optional recovery-key export because it would access credential-like management secrets without explicit authorization. No recovery keys were exported or read as a workaround. The existing Stop sharing UI was used to revoke the synthetic link instead. Permanent deletion through the browser requires action-time confirmation, so the remaining file is not falsely described as deleted.

No user recordings, keys, schema, bucket visibility, billing plan or existing production protection settings were changed. No paid API was introduced. The pre-existing shared checkout changes were preserved; implementation used an isolated worktree and the public, verified GitHub repository.

## Verdict and boundaries

**The seven reported defects: fixed and verified within the scopes above.**

**Release: READY WITH KNOWN LIMITATIONS for the tested constrained beta scope.** Native screen-picker completion, physical Android/iOS/Safari behaviour, real hardware camera/microphone combinations and universal reliability remain uncertified. ScreenNote still has its disclosed five-minute/25MiB/16-global-slot limits, demand-driven cleanup and finite bearer playback URL lifetime. This record is not a claim that every feature on every device works 100% without failure.
