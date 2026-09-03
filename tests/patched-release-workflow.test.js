import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// String assertions, deliberately: this pins the workflow's load-bearing
// design (triggers, guard, check-before-publish, version scheme) without
// adding a YAML parser dependency for a single test file.
const here = path.dirname(fileURLToPath(import.meta.url))
const workflow = fs.readFileSync(path.join(here, '../.github/workflows/nightly-patched.yml'), 'utf8')

describe('nightly-patched release workflow', () => {
  it('fires only on the fork branch and only in the fork repo', () => {
    expect(workflow).toContain('branches: [nightly-patched]')
    expect(workflow).toContain("github.repository == 'codeon89/Atlas' && github.ref == 'refs/heads/nightly-patched'")
  })

  it('queues runs instead of cancelling (no duplicate release numbers)', () => {
    expect(workflow).toContain('group: nightly-patched-release')
    expect(workflow).toMatch(/cancel-in-progress:\s*false/)
  })

  it('gates on checks before anything can publish', () => {
    expect(workflow.indexOf('npm run check')).toBeLessThan(workflow.indexOf('npm run publish'))
  })

  it('derives p from published tags with a cold-boot default', () => {
    expect(workflow).toContain('UPSTREAM_NIGHTLY')
    expect(workflow).toContain('isDraft == false')
    expect(workflow).toContain('max // 0')
  })

  it('reuses a re-run draft but never overwrites a published tag', () => {
    expect(workflow).toContain('already exists as a draft; reusing it')
    expect(workflow).toContain('refusing to overwrite it')
  })

  // Uploaded names use dashes (`Atlas-Setup-0.9.9-...exe`): match whole-line,
  // never split on spaces. A regression here publishes nothing, ever.
  it('matches asset names whole-line for the publish gate', () => {
    expect(workflow).toContain('join("\\n")')
    expect(workflow).toContain('grep -qxF')
    expect(workflow).toContain('Atlas-Setup-${version}')
    const verifyAt = workflow.indexOf('Verify complete assets')
    expect(verifyAt).toBeGreaterThan(-1)
    expect(workflow).toContain('.exe.blockmap')
    expect(workflow).toContain('patched.yml')
    expect(workflow.indexOf('.exe.blockmap')).toBeGreaterThan(verifyAt)
  })

  it('publishes as a non-latest prerelease only after verification', () => {
    const editAt = workflow.indexOf('gh release edit')
    expect(editAt).toBeGreaterThan(-1)
    expect(workflow.slice(editAt, editAt + 120)).toContain('--draft=false --prerelease --latest=false')
    expect(workflow.indexOf('Missing or incomplete')).toBeLessThan(editAt)
  })

  it('skips the release when the HEAD commit carries [no-build]', () => {
    expect(workflow).toContain('[no-build]')
    expect(workflow).toContain('git log -1')
    expect(workflow).toContain("needs.prepare.outputs.skip != 'true'")
  })

  it('reads the nightly from merged upstream tags, file as fallback', () => {
    expect(workflow).toContain('--merged HEAD')
    expect(workflow).toContain('UPSTREAM_NIGHTLY')
  })

  it('reuses drafts via a plain jq comparison (gh --jq takes only an expression)', () => {
    expect(workflow).toContain("--jq '.isDraft'")
    expect(workflow).not.toContain('--jq -e')
    expect(workflow).not.toContain('--arg prefix')
  })
})
