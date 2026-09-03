import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// Execute the actual IPC module with only the OS boundary stubbed. No test may
// read or write the installed application's config/database.
function settingsHandlers(status = 'idle') {
  const file = path.join(here, '../electron/ipc/settings.js')
  const require = createRequire(file)
  const handlers = new Map()
  const writeFileSync = vi.fn()
  const ctx = {
    appConfig: { Interface: { appUpdateBranch: 'patched' }, Updates: { patchedVersion: '0.9.9-patched.nightly.494.1', upstreamNightlyTag: 'v0.9.9-nightly.494' }, Library: { rootPath: 'unchanged' } },
    configPath: 'unused.ini',
    lastUpdateStatus: { status },
    installAfterDownload: false,
    getConfiguredAppUpdateBranch: (config) => config.Interface?.appUpdateBranch,
    configureAppUpdateBranch: vi.fn(),
  }
  const sandbox = {
    module: { exports: {} }, console: { error: vi.fn() },
    require: (name) => name === 'electron'
      ? { ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) }, BrowserWindow: { getAllWindows: () => [] } }
      : name === 'fs' ? { ...fs, writeFileSync } : require(name),
  }
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file })
  sandbox.module.exports(ctx)
  return { ctx, save: handlers.get('save-settings'), writeFileSync }
}

describe('patched settings persistence', () => {
  it.each(['checking', 'downloading', 'downloaded', 'installing'])('rejects %s switches before writing disk or live config', async (status) => {
    const { ctx, save, writeFileSync } = settingsHandlers(status)
    expect((await save(null, { Interface: { appUpdateBranch: 'nightly' } })).success).toBe(false)
    expect(writeFileSync).not.toHaveBeenCalled()
    expect(ctx.appConfig.Interface.appUpdateBranch).toBe('patched')
    expect(ctx.configureAppUpdateBranch).not.toHaveBeenCalled()
  })

  it('keeps main-owned update receipts when a stale settings window saves', async () => {
    const { ctx, save } = settingsHandlers()
    expect((await save(null, { Interface: { appUpdateBranch: 'nightly' }, Updates: { patchedVersion: '', upstreamNightlyTag: 'old' } })).success).toBe(true)
    expect(ctx.appConfig.Updates).toEqual({ patchedVersion: '0.9.9-patched.nightly.494.1', upstreamNightlyTag: 'v0.9.9-nightly.494' })
    expect(ctx.appConfig.Library.rootPath).toBe('unchanged')
    expect(ctx.configureAppUpdateBranch).toHaveBeenCalledWith('nightly', { resetStatus: true })
  })
})
