import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// String assertions, deliberately: pins the fork CI's load-bearing design
// (fork-only guard, cache-before-install, same gate as upstream) without a
// YAML parser dependency, same convention as patched-release-workflow.test.js.
const here = path.dirname(fileURLToPath(import.meta.url))
const workflow = fs.readFileSync(path.join(here, '../.github/workflows/ci-patched.yml'), 'utf8')
const upstream = fs.readFileSync(path.join(here, '../.github/workflows/ci.yml'), 'utf8')

describe('ci-patched workflow', () => {
  it('runs only in the fork repo', () => {
    expect(workflow).toContain("github.repository == 'codeon89/Atlas'")
  })

  it('restores node_modules and skips reinstall on a hit', () => {
    expect(workflow).toContain('path: node_modules')
    expect(workflow).toContain("steps.nm-cache.outputs.cache-hit != 'true'")
    expect(workflow.indexOf('Restore node_modules')).toBeLessThan(workflow.indexOf('Install dependencies'))
  })

  // Same gate as upstream CI: extension build, vitest, full check. A step
  // dropped here silently weakens every fork PR, so pin them all.
  it('runs the same gate steps as upstream CI', () => {
    for (const step of ['npm run build:extension', 'npm run test:run', 'npm run check']) {
      expect(workflow).toContain(step)
      expect(upstream).toContain(step)
    }
  })
})
