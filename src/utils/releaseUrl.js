import { LINKS } from './links.js'

/**
 * The GitHub release page for a given app version.
 *
 * The tag format matches what the release workflows actually create:
 * .github/workflows/main.yml tags `v$(package.json version)` and
 * nightly.yml tags `v${base}-nightly.${run_number}`, so a plain `v` prefix in
 * front of the version string is correct for both stable and nightly builds.
 *
 * A leading `v` already on the version is stripped rather than doubled.
 * app.getVersion() returns package.json's version, which carries no prefix, so
 * this cannot fire today -- but `vv1.2.3` is not a tag either workflow creates,
 * and a URL that 404s is worse than one built from a normalized string.
 *
 * Release notes follow build identity, not the selected feed: patched
 * builds link to the fork's releases, everything else links upstream.
 */
export function releaseUrlFor(version) {
  const tag = String(version ?? '').trim().replace(/^v+/i, '')
  const repo = tag.includes('-patched.') ? 'https://github.com/codeon89/Atlas' : LINKS.github
  return `${repo}/releases/tag/v${tag}`
}
