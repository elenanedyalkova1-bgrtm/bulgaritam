# No-site release deployment recovery — 2026-11-05

The approved feature release was merged as f108fa3ee536987631ecd1dde796770b467a937e (PR #8). Public workflow run 41933524347 built and verified the artifact, verified assets, and uploaded documents, but timed out after 90 minutes before publishing the final manifest/state.

The completed job log identifies the blocker: the document phase's `get /.htaccess -o /tmp/live-htaccess` refused to overwrite the local file already created by the asset phase (`xfer:clobber is unset`). The protected remote `.htaccess` was not the problem and must not be overwritten.

This recovery changes only the first two **local** download destinations to `/tmp/live-htaccess-assets` and `/tmp/live-htaccess-documents`; finalization retains `/tmp/live-htaccess` and its existing nonempty-file check. The transfer protocol, byte verification, staging order, Baserow schema/data, product implementation and protected remote configuration are unchanged.

A regression test verifies that all three local destinations are distinct and remote `.htaccess` is never written/deleted. The focused workflow/incremental deployment suite passed all 16 tests.

The recovery branch is isolated from the original working tree and based directly on approved production f108fa3. No Studio, unfinished SEO/UX, dependency, Admin performance or other application changes are included. Production main was reconfirmed unchanged before recovery. The existing workflow will rebuild current Baserow data and byte-probe the partial live deployment, uploading only differences before publishing the final manifest/state.
