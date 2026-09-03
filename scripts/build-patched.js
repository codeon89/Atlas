'use strict'

// Fork build entry point. package.json keeps tracking upstream's base version,
// so version, owner and channel are stamped here at build time, keeping nightly
// merges free of version conflicts (see docs/FORK-PATCHED-RUNBOOK.md).
const path = require('node:path')
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')

const projectDir = path.resolve(__dirname, '..')

// Version parts must be plain numbers: a string part like `-P3` would make
// the updater compare alphabetically instead of numerically, stranding users
// on stale builds. Rejected up front.
function parseNonNegativeInt(raw, name) {
  const text = String(raw ?? '').trim()
  if (!/^(0|[1-9]\d*)$/.test(text)) {
    throw new Error(`${name} must be a non-negative integer without leading zeros (got ${JSON.stringify(text)}).`)
  }
  const value = Number(text)
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} is too large to represent exactly (got ${text}).`)
  }
  return value
}

// Which upstream nightly we follow, read from UPSTREAM_NIGHTLY (bumped each
// merge-down) so a release is never stamped against the wrong nightly.
function readUpstreamNightly() {
  const raw = fs.readFileSync(path.join(projectDir, 'UPSTREAM_NIGHTLY'), 'utf8')
  return parseNonNegativeInt(raw, 'UPSTREAM_NIGHTLY')
}

// Builds `0.9.9-patched.nightly.494.1` from its parts. The base is everything
// before the first hyphen, so a prerelease base can't leak into the tail.
function resolvePatchedVersion(pkgVersion, nightly, number) {
  const base = String(pkgVersion || '').split('-')[0]
  if (!/^\d+\.\d+\.\d+$/.test(base)) {
    throw new Error(`Cannot derive a fork version from package.json version ${JSON.stringify(pkgVersion)}.`)
  }
  const n = parseNonNegativeInt(nightly, 'nightly')
  const p = parseNonNegativeInt(number, 'number')
  return `${base}-patched.nightly.${n}.${p}`
}

async function run() {
  // Loaded here, not at the top, so importing this file (tests) stays free
  // of side effects: no builder load, no git, no disk writes.
  const { build, Platform, Arch } = require('electron-builder')
  const pkg = require('../package.json')
  const nightly = process.env.PATCHED_NIGHTLY || readUpstreamNightly()
  // An unset number means a local throwaway build, which must never publish:
  // CI always sets PATCHED_BUILD_NUMBER explicitly from the release count.
  const number = process.env.PATCHED_BUILD_NUMBER || '0'
  const publish = process.argv.includes('--publish')
  if (publish && String(number).trim() === '0') {
    throw new Error('Set PATCHED_BUILD_NUMBER before publishing; p=0 is reserved for local builds.')
  }
  const version = resolvePatchedVersion(pkg.version, nightly, number)
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectDir, encoding: 'utf8', windowsHide: true }).trim()
  await build({
    projectDir,
    targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
    publish: publish ? 'always' : 'never',
    config: {
      directories: { output: `release/patched-${nightly}-${number}` },
      extraMetadata: {
        version,
        atlasBuildSource: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
        atlasBuildCommit: commit,
      },
      // Explicit so a future builder default can't silently drop the blockmap;
      // the publish gate's blockmap check is the backstop.
      nsis: { differentialPackage: true },
      // Deliberately explicit: neither an inherited upstream config nor a new
      // remote can redirect a personal publish into someone else's repository.
      publish: {
        provider: 'github', owner: 'codeon89', repo: 'Atlas', channel: 'patched',
        releaseType: 'draft', vPrefixedTagName: true,
      },
    },
  })
}

// Direct execution builds; imports expose only the pure helpers.
if (require.main === module) {
  run().catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}

module.exports = { resolvePatchedVersion, parseNonNegativeInt, readUpstreamNightly }
