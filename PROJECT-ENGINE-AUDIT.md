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

## Blocked live acceptance and test artifacts

Automatic approval review rejected a follow-up to the production smoke process because general project-verification authorization was judged insufficiently explicit for disposable production uploads/publication. No alternate route was used to continue those production writes. The task-owned smoke process is no longer running.

The larger disposable 5070338-byte upload was left pending after its first 2097152-byte part; this does not prove multipart publication, resume, or cleanup. A read-only inspection found that pending clip and the browser-published sample, with two media objects totalling 2445863 bytes. They are task-created synthetic artifacts. Approval is needed to finish live feedback, password, resume, revocation and deletion testing and remove only these test artifacts. No existing user videos or recovery keys were deleted.

Native screen-picker completion, camera/microphone flows, physical Android/iOS/Safari, and current live feedback/reaction/password/revoke/delete acceptance remain unverified. Historical passing tests do not establish these migrated production paths.

## Verdict

**NOT READY for full production-release acceptance.** The storage outage is repaired and small-clip publication/recipient playback are directly proven. Local and simulated tests pass, but the remaining core migrated live paths require the specifically blocked test authorization. No universal reliability or complete end-to-end certification is claimed.

Final follow-up source changes to this report and tests/ui/fixture.js do not alter the production source fingerprint; the fixture change teaches the simulated API the new upload-state operation. The production application remains at the verified implementation SHA above.
