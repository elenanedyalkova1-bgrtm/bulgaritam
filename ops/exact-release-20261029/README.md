# One approved exact-artifact release; no build

Operator authorization: 2026-10-29, publish only public artifact
bulgaritam-public-40527313369-1 from b629cd7d1a5a30e2efc9063128e773d8e49888da.
The operational branch changes only the existing manual workflow and this folder.
It must not be merged as a functional site change.

- Pinned ZIP ID, run, name, source commit and SHA-256; CRC and safe extraction.
- Download exact rollback ZIP and verify its SHA/CRC; bundled 9-file rollback
  supplement has a separately pinned SHA/CRC. Neither is ever uploaded to public.
- Read-only FTPS jailed-root baseline verification; preserve hosting .htaccess.
- Immediate HTTP baseline, all artifact file hashes, exact approved plan,
  1790 rollback file hashes, exact 22 Baserow ID/slug/inactive-value checks.
- Assets -> HTTP/SHA barrier -> documents -> HTTP/SHA barrier -> fresh inactive
  check -> exact 22 owned stale HTML deletions -> manifest -> completed state.
- All 1768 managed public files and completed state verified after publication,
  22 stale index URLs checked, 13 preserved routes plus ZinaArts and 14 images.
- No Baserow writes, Vercel operations, new build, functional source changes,
  marketing emails or form submissions. Hosting .htaccess and old assets retained.
- Every failure stops dependent steps. Evidence collection is always enabled.
  There is NO automatic rollback. Re-running after partial publication fails
  baseline checks; inspect actual state and obtain an updated plan first.

`mode=preflight` performs no production writes. `mode=deploy` performs the same
checks before writing. Uses existing public-production environment protection,
production concurrency lock and GitHub FTPS secrets. Secrets pass to lftp stdin,
never command arguments or public files. Only sanitized logs are retained.
