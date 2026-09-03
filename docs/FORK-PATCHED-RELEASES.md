# Nightly-Patched releases (codeon89/Atlas)

Plain-language reference for the fork's own release line. Procedures live in
`docs/FORK-PATCHED-RUNBOOK.md`.

## What it is

Nightly-Patched is this fork's installable release line: upstream Atlas nightly
plus the fork's patches, as a Windows installer with working auto-update.
Settings offers three update channels — Stable and Nightly (upstream's,
explicit opt-in with a replacing warning) and Nightly-Patched (this fork, the
default for fork builds).

## Versions

`0.9.9-patched.nightly.494.1` reads as: upstream base `0.9.9`, upstream
nightly `494`, first patched build on that nightly. Merging a new upstream
nightly restarts the last number at `1` automatically. Numbers only ever go up,
so the updater never gets stuck on a stale build.

## Where things live

- Releases: this fork's Releases page, as prereleases that are never marked
  "latest" (they can't hijack anyone's Stable channel).
- Upstream can never overwrite a patched install: patched builds check only
  the fork feed. Upstream nightlies appear as an informational notice linking
  to their release notes — never as a download.

## Files involved

- `UPSTREAM_NIGHTLY` — which upstream nightly is currently merged in.
- `scripts/build-patched.js` — stamps the version at build time, so
  `package.json` never changes for releases and upstream merges stay clean.
- `.github/workflows/nightly-patched.yml` — the build, scan, and publish
  pipeline (gated on the full `npm run check` before anything is drafted).
