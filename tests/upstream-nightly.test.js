import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { nightlyNotice } = require('../electron/utils/upstreamNightly')

// Mirror the GitHub releases shape without touching the network or user data.
const release = (number, overrides = {}) => ({
  tag_name: `v0.9.9-nightly.${number}`,
  prerelease: true,
  draft: false,
  published_at: new Date(number * 1000).toISOString(),
  assets: ['nightly.yml', 'Atlas-Setup.exe'].map((name) => ({ name, size: 100, state: 'uploaded' })),
  ...overrides,
})

describe('upstream nightly notices', () => {
  it('groups new releases after time offline and ignores API ordering', () => {
    const notice = nightlyNotice([release(491), release(494), release(493)], 'v0.9.9-nightly.491')
    expect(notice).toEqual({
      tag: 'v0.9.9-nightly.494', version: '0.9.9-nightly.494', count: 2,
      url: 'https://github.com/towerwatchman/Atlas/releases/tag/v0.9.9-nightly.494',
    })
  })

  it('does not repeat an acknowledged release', () => {
    expect(nightlyNotice([release(494)], 'v0.9.9-nightly.494')).toBeNull()
  })

  it('ignores drafts, incomplete uploads, stable and patched releases', () => {
    const releases = [
      release(495, { draft: true }),
      release(496, { assets: [] }),
      release(497, { tag_name: 'v0.9.9' }),
      release(498, { tag_name: 'v0.9.9-patched.nightly.494.1' }),
      release(499, { assets: [{ name: 'nightly.yml', state: 'uploaded', size: 100 }] }),
      release(500, { assets: [{ name: 'nightly.yml', state: 'uploaded', size: 0 }, { name: 'setup.exe', state: 'uploaded', size: 100 }] }),
      release(494),
    ]
    expect(nightlyNotice(releases, '')?.tag).toBe('v0.9.9-nightly.494')
  })

  it('reports the latest without guessing a count when history is unavailable', () => {
    expect(nightlyNotice([release(494)], 'v0.9.9-nightly.1')?.count).toBeNull()
    expect(nightlyNotice([], '')).toBeNull()
    expect(() => nightlyNotice({ message: 'rate limited' }, '')).toThrow()
  })
})
