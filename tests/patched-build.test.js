import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// Required, never executed: the builder only runs under `require.main`, so
// importing is side-effect free (no electron-builder load, no git, no disk).
const { resolvePatchedVersion, parseNonNegativeInt, readUpstreamNightly } = require('../scripts/build-patched.js')
// Same semver copy electron-updater compares with: a version that only parses
// under a different copy is a version the updater itself would reject.
const semver = require('electron-updater/node_modules/semver')

describe('resolvePatchedVersion', () => {
  it('assembles base + nightly + build number', () => {
    expect(resolvePatchedVersion('0.9.9', 494, 1)).toBe('0.9.9-patched.nightly.494.1')
  })

  it('reserves p=0 for local builds', () => {
    expect(resolvePatchedVersion('0.9.9', 494, 0)).toBe('0.9.9-patched.nightly.494.0')
  })

  // package.json tracks upstream's plain base, but if it ever carried a
  // prerelease tag the fork version must not inherit it — the tail below
  // fully describes this build.
  it('strips any prerelease from the base version', () => {
    expect(resolvePatchedVersion('0.9.9-nightly.100', 494, 1)).toBe('0.9.9-patched.nightly.494.1')
  })

  it.each(['', 'not-a-version', '0.9', 'v0.9.9'])('rejects base %p', (base) => {
    expect(() => resolvePatchedVersion(base, 494, 1)).toThrow()
  })

  it.each([
    ['494.5', '-1'],
    ['-1', '494.5'],
    ['49x', '1'],
    ['1', '1.5'],
    ['0494', '1'],
    ['9007199254740993', '1'],
  ])('rejects nightly=%p number=%p', (nightly, number) => {
    expect(() => resolvePatchedVersion('0.9.9', nightly, number)).toThrow()
  })
})

describe('parseNonNegativeInt', () => {
  it.each([['0', 0], ['1', 1], ['494', 494], [494, 494], ['  7  ', 7]])('parses %p as %p', (raw, expected) => {
    expect(parseNonNegativeInt(raw, 'test')).toBe(expected)
  })

  it.each(['', '  ', '-1', '01', '1.5', 'abc', null, undefined])('rejects %p', (raw) => {
    expect(() => parseNonNegativeInt(raw, 'test')).toThrow()
  })
})

describe('fork version ordering (Decision 2)', () => {
  // The whole point of the all-numeric tail: these must compare numerically,
  // not lexically. A `-P3`-style suffix would invert both assertions.
  it('orders build numbers numerically within one nightly', () => {
    expect(semver.gt('0.9.9-patched.nightly.494.10', '0.9.9-patched.nightly.494.3')).toBe(true)
  })

  it('orders nightly numbers numerically across digit lengths', () => {
    expect(semver.gt('0.9.9-patched.nightly.1000.1', '0.9.9-patched.nightly.999.9')).toBe(true)
  })

  it('orders a newer nightly above any build of an older one', () => {
    expect(semver.gt('0.9.9-patched.nightly.495.1', '0.9.9-patched.nightly.494.99')).toBe(true)
  })

  // electron-updater matches the feed channel against prerelease[0]: this is
  // what routes fork builds to `patched.yml` instead of `nightly.yml`.
  it('keeps patched as the channel word', () => {
    expect(semver.prerelease('0.9.9-patched.nightly.494.1')[0]).toBe('patched')
  })
})

describe('readUpstreamNightly', () => {
  // Asserts shape, not the pinned number: this file is bumped at every
  // merge-down and the test must survive that bump.
  it('reads a plain integer from UPSTREAM_NIGHTLY', () => {
    expect(String(readUpstreamNightly())).toMatch(/^(0|[1-9]\d*)$/)
  })
})
