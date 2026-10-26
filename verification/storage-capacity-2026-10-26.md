# ScreenNote v0.3.3 — storage capacity

The connected Supabase organization fbahvppdpyruuuwynlon reports Free. Supabase's published Free allowance is 1 GB file storage organization-wide. ScreenNote's current storage inspection found one media object, 10,704,790 bytes, and a private bucket. The other listed organization projects are inactive; their retained storage and billing-period usage have not been measured. Egress, function and hosting quotas remain separate limits.

## Change

The fixed 16-recording cap is removed. Uploads share a 1,000,000,000-byte budget. Pending reservations hold twice their video size so that private chunks and the assembled video can coexist. The extra reservation is released only after chunk cleanup succeeds. Owner deletion releases capacity only after media cleanup. All allocations use the existing revision compare-and-swap mechanism, preventing concurrent requests from independently booking the same free bytes.

Legacy capacity entries acquire size allocations and retention deadlines without changing media or owner keys. Expired/abandoned entries are reclaimed under capacity pressure; candidate cleanup is bounded to four entries per request. A 10,000-record metadata safety bound keeps the capacity ledger within the existing 2 MB metadata transport limit. This is an implementation bound, not a promise that 10,000 maximum-sized videos fit.

An otherwise empty budget accommodates 37 sequential maximum-sized 25 MiB videos while still reserving assembly space for each upload. More smaller videos fit. Nineteen maximum-sized uploads can be pending simultaneously; the twentieth is denied until space is released. The five-minute/25 MiB per-video limits, private access controls, expiry rules and billing plan are unchanged.

The health response reports maxStorageBytes, reservedBytes, availableBytes and reservedRecordings. These are application reservations, not a provider billing meter or remaining monthly egress. Other organization storage and provider restrictions can still limit service.

## Local verification

88 tests pass, including acceptance above sixteen small reservations, maximum-size sequential uploads, simultaneous pending-byte bounds, legacy migration, deletion accounting, late finalization, failed chunk-cleanup retention and eventual release on retry. Existing owner/password/media/UI helpers remain covered. Build and whitespace checks pass.

Production acceptance and final release identity are reported after deployment. No production capacity-filling stress test is performed; limit boundaries use isolated stores. Actual service acceptance uses small synthetic files and task-owned reservation cleanup.

## Sources checked

- https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/manage-your-usage/egress
- https://supabase.com/changelog.md was attempted but the research fetch could not parse its markdown content type. No Supabase API or schema change is introduced by this release; allocation lives in the existing private metadata record.
