import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const SemVer = require('electron-updater/node_modules/semver').SemVer
const here = path.dirname(fileURLToPath(import.meta.url))
const main = fs.readFileSync(path.join(here, '../electron/main.js'), 'utf8')

// Run the real channel functions without booting Electron or touching user data.
// The slice covers normalizeAppUpdateBranch() through the last channel helper;
// the module-level configureAppUpdateBranch(...) invocation below it is
// excluded by ending the slice at that call.
function updaterContext(version = '0.9.9-patched.nightly.494.1') {
  const autoUpdater = {
    currentVersion: new SemVer(version),
    setFeedURL: vi.fn(),
  }
  const ctx = vm.createContext({
    app: { getVersion: () => version },
    appConfig: { Updates: { stableVersion: '0.9.8', nightlyVersion: '0.9.9-nightly.494', patchedVersion: version } },
    autoUpdater,
    activeAppUpdateBranch: null,
    lastUpdateStatus: { status: 'idle' },
    updateInfo: null,
    updateDownloaded: false,
    installAfterDownload: false,
    semver: null,
    writeConfigSafely: vi.fn(),
    sendUpdateStatus: vi.fn(),
    updaterLog: vi.fn(),
    console: { log: vi.fn() },
  })
  vm.runInContext(main.slice(main.indexOf('function normalizeAppUpdateBranch('), main.indexOf('\nconfigureAppUpdateBranch(getDefaultAppUpdateBranch())')), ctx)
  return ctx
}

describe('patched update channel', () => {
  it.each([
    ['0.9.9', 'stable'],
    ['0.9.9-nightly.494', 'nightly'],
    ['0.9.9-patched.nightly.494.1', 'patched'],
  ])('identifies the actual build %s independently of settings', (version, branch) => {
    const ctx = updaterContext(version)
    expect(ctx.getDefaultAppUpdateBranch()).toBe(branch)
  })

  // Fork versions contain the word `nightly` (`-patched.nightly.494.1`), but
  // only ever dot-prefixed. Detection must test `-patched.` first: matching
  // bare `nightly` would route fork builds at the upstream feed.
  it('resolves a patched.nightly version to patched, never to nightly', () => {
    const ctx = updaterContext('0.9.9-patched.nightly.494.1')
    expect(ctx.normalizeAppUpdateBranch('patched')).toBe('patched')
    expect(ctx.getConfiguredAppUpdateBranch({ Interface: { appUpdateBranch: 'patched' } })).toBe('patched')
    expect(ctx.getDefaultAppUpdateBranch()).toBe('patched')
  })

  it.each([
    ['stable', 'towerwatchman', 'latest', false, '0.9.8'],
    ['nightly', 'towerwatchman', 'nightly', true, '0.9.9-nightly.494'],
    ['patched', 'codeon89', 'patched', true, '0.9.9-patched.nightly.494.1'],
  ])('routes %s to its own feed and installed-version baseline', (branch, owner, channel, prerelease, baseline) => {
    const ctx = updaterContext()
    ctx.configureAppUpdateBranch(branch)
    expect(ctx.autoUpdater.setFeedURL).toHaveBeenCalledWith({ provider: 'github', owner, repo: 'Atlas', channel })
    expect(ctx.autoUpdater.channel).toBe(channel)
    expect(ctx.autoUpdater.allowPrerelease).toBe(prerelease)
    expect(ctx.autoUpdater.allowDowngrade).toBe(false)
    expect(ctx.autoUpdater.currentVersion.format()).toBe(baseline)
    expect(ctx.autoUpdater.currentVersion).toBeInstanceOf(SemVer)
  })

  it('records a patched build without overwriting the official channel baselines', () => {
    const ctx = updaterContext()
    ctx.recordRunningBuildVersion()
    expect(ctx.appConfig.Updates).toEqual({ stableVersion: '0.9.8', nightlyVersion: '0.9.9-nightly.494', patchedVersion: '0.9.9-patched.nightly.494.1' })
  })

  it.each(['checking', 'downloading', 'downloaded', 'installing'])('rejects a channel switch while %s', (status) => {
    const ctx = updaterContext()
    ctx.activeAppUpdateBranch = 'patched'
    ctx.lastUpdateStatus = { status }
    expect(() => ctx.configureAppUpdateBranch('nightly', { resetStatus: true })).toThrow()
    expect(ctx.autoUpdater.setFeedURL).not.toHaveBeenCalled()
    expect(ctx.activeAppUpdateBranch).toBe('patched')
  })

  it('clears an available offer when switching before a download', () => {
    const ctx = updaterContext()
    ctx.configureAppUpdateBranch('patched')
    ctx.lastUpdateStatus = { status: 'available' }
    ctx.updateInfo = { version: '0.9.9-patched.nightly.494.2' }
    ctx.autoUpdater.updateInfoAndProvider = { old: true }
    ctx.configureAppUpdateBranch('stable', { resetStatus: true })
    expect(ctx.updateInfo).toBeNull()
    expect(ctx.autoUpdater.updateInfoAndProvider).toBeNull()
    expect(ctx.sendUpdateStatus).toHaveBeenCalledWith({ status: 'idle' }, 'update-branch-changed')
  })
})
