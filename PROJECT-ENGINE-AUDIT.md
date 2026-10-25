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
