import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// String assertions, deliberately: this pins the fork's divergence in the
// upstream policy file (nightly-patched base accepted; changelog and
// AI-disclosure rules dropped) without adding a YAML parser dependency for
// a single test file. If an upstream merge-down rewrites either spot, this
// fails instead of silently locking fork PRs out again.
const here = path.dirname(fileURLToPath(import.meta.url))
const policy = fs.readFileSync(path.join(here, '../.github/workflows/pr-policy.yml'), 'utf8')

describe('fork pr-policy divergence', () => {
  it('accepts nightly-patched alongside nightly as a base', () => {
    expect(policy).toContain('[ "$BASE" != "nightly" ] && [ "$BASE" != "nightly-patched" ]')
  })

  it('does not enforce changelog entries', () => {
    expect(policy).not.toContain('Changelog entry')
  })

  it('keeps the tests gate but drops AI-disclosure enforcement', () => {
    expect(policy).toContain('Code changes must come with tests')
    expect(policy).not.toContain('AI assistance must be disclosed')
  })
})
