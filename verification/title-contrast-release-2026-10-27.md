# ScreenNote title persistence and contrast release

Baseline: GitHub main 294b986a054588f682e1446fae100288cc7a1505, the merged recording/workspace PR #3. The separately opened revert PR #4 is unmerged and contains no explanatory human comment; this release does not act on it.

Scope: preserve current main, including native recording/recovery changes, while fixing local title state around publish validation or IndexedDB failure. Use copied candidate objects and commit selected state only after persistence succeeds. Retain edited fields on initial publish-save failure. Darken sampled muted/accent text to the audited contrast tokens.

The prior audit's local commits survived in the shared repository object database. These two source changes and publishing-title regressions were reconciled against the actual current main source. Newer restoreKeys recovery handling is explicitly preserved.

Validation before publication: 111 Node tests pass, no skips; build passes. The focused publishing regression asserts invalid settings and failed local persistence do not overwrite the saved object. Previous audited ten-width browser evidence was recovered; a fresh browser retest and production deployment verification are recorded separately.

No runtime dependency, migration, storage permission, Android native source, recording limit or customer data change is included. Physical capture quality and Play Store readiness remain outside this scoped release.
