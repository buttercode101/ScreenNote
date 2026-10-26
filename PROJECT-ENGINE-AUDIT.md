# ScreenNote — Universal Project Engine

## Mission and acceptance
For someone explaining work asynchronously, record or import a short video, review and edit it locally, explicitly publish it, and let a recipient play and reply without an account. Preserve the local copy and enforce owner management permissions.

Acceptance: local import/review/trim/download/persistence; publish and resume bounded chunks; real private-storage playback; password protection; timestamped feedback and deduplication; owner-only management; revoke/delete; honest failure states; responsive rendered phone/tablet/desktop checks; source/build/deployment reconciliation. Native browser capture and physical devices require separate actual evidence.

## Starting state — directly observed
- GitHub main d7a01c53c5c6c40d40dcd0f7e20554250246b1f0 contained the imported existing source.
- Vercel production dpl_HV7rgo7B7pHBYr2HGGydmpHxnqNQ served v0.2.3 and health failed with STORAGE_ACCESS_UNAVAILABLE.
- Local v0.3.0 Supabase edits existed but were uncommitted and untested against the service.
- Dedicated Supabase project burrqaxylibmlkgfqlww was active but had no public tables, no storage buckets and no Edge Functions. Earlier preparation claims did not describe the inspected live state.
- The original 66 tests passed using simulated storage; this did not prove live sharing.

## Changes and initial evidence
- Applied the checked-in private-sharing migration to the dedicated project.
- Deployed a server-to-server gateway authenticated by a random capability whose SHA-256 digest is stored in Postgres. Configured Vercel server environment without exposing key values.
- RLS and explicit privilege revocation deny browser roles; RPCs are service-only; media bucket is private. No public policies are intentional for this server-only access model.
- Completed adapter routing and resumable part status; validated configuration fail-closed; malformed gateway bodies return 400.
- Added coverage for CAS conflicts, binary parts, configuration, gateway authorization, part completeness, size limits, private-bucket checking and error redaction. All 73 automated tests pass locally.
- Corrected privacy/storage disclosures and added an explicit recovery path for missing older uploads. Original local videos and historical recovery keys are preserved; old remote media was not migrated while reads were denied.
- Release fingerprint now covers the Supabase function and migration source as well as application/API source.

## Release evidence
Live runtime, browser, deployment and final verdict evidence will be appended after verification. The checks above alone are not a production-ready claim.

## Verified release evidence

- GitHub implementation commit: b5193d673981226a447f4836ab0c3ea03b22ae03.
- Vercel production: dpl_8D9kcsdsgP7M2bq3ht8wGg1ug7YP, READY, built from that exact GitHub SHA. Canonical tested URL: https://screennote-woad.vercel.app/.
- The served v0.3.0 release manifest's source fingerprint equals the locally tested build, including gateway/migration sources. Clean builds exclude QA fixture pages.
- Live health returns configured true, maxBytes 26214400, maxSeconds 300; the former suspended-storage failure is resolved for the new backend.
- A real browser-generated seven-second sample (348711 bytes) was explicitly published through the production UI. A recipient opened the unlisted link, loaded 960x540 media with readyState 4 and no media error, and played to ended=true at 7.008 seconds.
- A local trim of seconds 1–4 produced a downloadable 174729-byte, 3.000-second WebM with VP8 video and Opus audio. ffprobe recognized both streams and duration; it also logged a WebM unknown-sized-element warning, so universal decoder compatibility is not claimed. Original and trimmed clips persisted after reload.
- Local simulated-service frames were measured at 390, 768 and 1600 CSS pixels for editor, loaded viewer, recovered management and offline states. No horizontal overflow: scrollWidth equalled clientWidth. This is iframe viewport emulation, not physical-device evidence.
- A local simulated recipient reply rendered literal script-like text safely and restored the submit control. It is not a production database feedback test.
- Seventy-three automated tests pass; dependency audit reports zero known vulnerabilities. Source syntax and whitespace checks pass.
- All four public tables have RLS; anon SELECT and authenticated UPDATE privileges are false. Both privileged RPCs deny anon/authenticated execution. Storage bucket is private. Informational no-policy advisories are intentional for service-only access, not a reason to add public policies.

## Historical approval gate — superseded on 26 October 2026

Automatic approval review rejected a follow-up to the production smoke process because general project-verification authorization was judged insufficiently explicit for disposable production uploads/publication. No alternate route was used to continue those production writes. The task-owned smoke process is no longer running.

The larger disposable 5070338-byte upload was left pending after its first 2097152-byte part; this does not prove multipart publication, resume, or cleanup. A read-only inspection found that pending clip and the browser-published sample, with two media objects totalling 2445863 bytes. They are task-created synthetic artifacts. The user subsequently explicitly approved these tests and cleanup; see the completed acceptance record below. No existing user videos or recovery keys were deleted.

Native screen-picker completion, camera/microphone flows, physical Android/iOS/Safari, and current live feedback/reaction/password/revoke/delete acceptance remain unverified. Historical passing tests do not establish these migrated production paths.

## Approved production acceptance — 26 October 2026

The user explicitly approved synthetic production uploads, password/feedback tests, revocation and deletion, including cleanup of the two earlier test artifacts. The approval gate is resolved.

Two real production scenarios passed: an unprotected and a password-protected 5070338-byte WebM, each uploaded in three parts. The unprotected scenario resumed the existing first chunk after a process interruption. Both scenarios also renewed the reservation, checked saved-part status, retried the same chunk safely, skipped saved chunks, and completed publication.

Verified on the actual Vercel → authenticated Supabase gateway → Postgres/private Storage path:

- Invalid owner capabilities returned 403 for manage, upload-state, publish, details, revoke and delete.
- Invalid chunk indexes were rejected; duplicate part uploads were safe.
- Missing/wrong sharing passwords returned 401 without a playback URL. The locked browser viewer displayed the password form with zero video elements.
- Correct access downloaded exactly the original 5070338 bytes. SHA-256 for both downloads: 6d95d58be9d80cb61ed4baae4305f69e20deb2313da84d9014aeae293bd5aa9a.
- Repeated publication was safe; public responses omitted owner/password hashes, salt and raw voter identifiers.
- Duplicate reply event IDs produced one reply. Two concurrent additional replies persisted without losing any comment.
- Repeated reactions did not inflate counts; switching and removing a reaction produced the expected counts.
- Updated captions/chapters/report state persisted without losing replies.
- Revocation blocked new viewing, comments and reactions with 404; the owner could still manage/delete the clip, and could not republish the revoked link.
- Deletion and repeated deletion succeeded, cleanupComplete was true, the viewer returned 404, and a previously issued media URL no longer returned the video.
- A separate live cross-origin request was rejected with HTTP 403.
- Actual recipient UI posted and persisted a literal-text timestamped reply and a reaction on the earlier browser-generated sample. Reloading its deleted link then displayed “This message is unavailable.”

These are executed integration/browser observations, not conclusions drawn from simulated storage. Sanitized scenario results are preserved in verification/live-sharing-2026-10-26.json. The test process exited successfully.

## Cleanup evidence

The two new scenarios were deleted through normal owner-authorized API requests. The earlier two artifacts were removed using the existing authenticated service gateway after verifying each exact task ID, title and byte size. Their media/parts were removed before releasing capacity. All four deleted test metadata records were then removed with exact-match guards and a check that no media/parts remained; their test comments and reactions were removed by the existing foreign-key cascade. No unrelated recordings were deleted.

A final direct database/storage inspection returned media_objects=0, clip_records=0, comments=0, reactions=0 and active_reservations=0. Private scratch recovery capabilities for the new tests were removed after cleanup; no key values are included in this report.

## Current verdict

**Approved cloud-sharing acceptance: PASS.** The previously blocked migrated upload/resume, password, feedback, revocation and deletion paths are now directly verified. The constrained import/local-review/share beta is **READY WITH KNOWN LIMITATIONS** for the tested scope.

This is not complete native/physical-device or commercial certification. Native screen-picker completion, real camera/microphone combinations, physical Android/iOS/Safari, account-specific operating economics and unrestricted scale remain unverified. Existing limits remain: five minutes, 25 MiB, 16 global shared reservations, demand-driven cleanup and bounded residual access for already issued playback URLs. The earlier nonfatal WebM decoder warning remains documented.

No application source fix was needed during this approved run; tests passed against the deployed implementation. Follow-up report, README, release-gate and evidence changes correct stale documentation and do not alter the application source fingerprint. Final publication reconciles the updated GitHub source commit with Vercel separately from the tested implementation commit above.
