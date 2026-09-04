# Nightly-Patched runbook (codeon89/Atlas)

Evergreen fork-only operations. Plain-language overview:
`docs/FORK-PATCHED-RELEASES.md`.

## What triggers a build

Any push to `nightly-patched` builds exactly one release — one push, one `p`,
however many commits the push contains. Manual `workflow_dispatch` also builds
(a new `p`). A GitHub Re-run retries the same release (same `p`, reuses the
draft). Never version, tag, or publish anything by hand; never touch
`package.json` for releases.

## Merge-down checklist (do locally, push once)

1. `git checkout nightly-patched && git pull && git merge nightly`,
   resolving conflicts in favour of fork-only hunks.
2. The nightly number needs no lookup: the workflow uses the highest
   `v{base}-nightly.N` tag reachable from HEAD, falling back to
   `UPSTREAM_NIGHTLY` when no tags are found. The file still feeds local
   `npm run build`, so update it when you merge.
3. Update `CHANGELOG.PATCHED.md`: move newly-merged items from "Fork's Nightly
   Changes" to the merged section; leave "Independent Changes" alone.
4. Run `npm run check`, then push. One push -> one `p` -> one release whose
   notes name the upstream nightly tag + sha.

Pushing the merge first and the changelog fix after produces two releases
(harmless but noisy). Batch everything, then push once.

## Fork-only fixes

No file changes required: pushing any commit to `nightly-patched` builds a
new `p` on the current nightly automatically.

## If a run fails

Use Re-run (same `p`). The workflow reuses the existing draft and refuses to
overwrite a published tag, so retries are safe. Use `workflow_dispatch` only
for a deliberate fresh build (it mints a new `p`).

## First-ever run

No prior releases exist, so counting starts at zero and the first release is
`.1` automatically. Nothing special to do.

## Fork repository settings (one-time)

In the fork's GitHub Actions settings, disable the upstream `main`, `nightly`,
and `CI` workflows so a stray push can never publish upstream and PRs run the
fork's cached `ci-patched.yml` instead of both (same gate, skips `npm ci` when
the lock file is unchanged). `pr-policy` stays enabled: it is fork-aware
(accepts `nightly-patched` bases, no changelog or AI-disclosure enforcement),
so it gates fork PRs on base and tests instead of failing them.
Review upstream changes to it on every merge-down.
