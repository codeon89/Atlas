// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import Interface from '../src/components/settings/Interface.jsx'
import { useAppUpdate } from '../src/hooks/useAppUpdate.js'
import { ToastProvider } from '../src/components/ui/toast/ToastContext.jsx'

afterEach(() => { cleanup(); vi.restoreAllMocks(); delete window.electronAPI })

// The bridge is asynchronous in production, including when returning a cached
// state, so UI tests must exercise that order instead of assigning state.
function bridge(state = { status: 'idle', branch: 'patched', build: { version: '0.9.9-patched.nightly.494.1', branch: 'patched', source: 'local' } }) {
  window.electronAPI = {
    getConfig: vi.fn(async () => ({ Interface: { appUpdateBranch: 'patched' } })),
    getAppUpdateState: vi.fn(async () => state),
    saveSettings: vi.fn(async () => ({ success: true })),
    onUpdateStatus: vi.fn(() => () => {}),
    onUpstreamNightlyAvailable: vi.fn(() => () => {}),
    acknowledgeUpstreamNightly: vi.fn(async () => ({ success: true })),
    openExternalUrl: vi.fn(),
    checkAppUpdate: vi.fn(),
    downloadAndInstallAppUpdate: vi.fn(),
    installAppUpdate: vi.fn(),
  }
  return window.electronAPI
}

describe('patched update UI', () => {
  it('shows three channels with Nightly-Patched first, plus the running build', async () => {
    bridge()
    render(<Interface />)
    await screen.findByText(/Running build: patched \/ 0.9.9-patched.nightly.494.1 \(local\)/)
    const select = screen.getByRole('combobox', { name: 'Branch' })
    expect([...select.options].map((option) => option.value)).toEqual(['patched', 'stable', 'nightly'])
    expect(select.value).toBe('patched')
  })

  it('rejecting the official-replacement confirm keeps the fork feed', async () => {
    const api = bridge()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Interface />)
    await screen.findByText(/Running build:/)
    fireEvent.change(screen.getByRole('combobox', { name: 'Branch' }), { target: { value: 'nightly' } })
    expect(window.confirm).toHaveBeenCalledOnce()
    expect(api.saveSettings).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: 'Branch' }).value).toBe('patched')
  })

  it('persists an explicitly confirmed channel switch', async () => {
    const api = bridge()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Interface />)
    await screen.findByText(/Running build:/)
    fireEvent.change(screen.getByRole('combobox', { name: 'Branch' }), { target: { value: 'stable' } })
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith({ Interface: { appUpdateBranch: 'stable' } }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Branch' }).value).toBe('stable'))
  })

  it('keeps the real channel and shows a rejected settings save', async () => {
    const api = bridge()
    api.saveSettings.mockResolvedValue({ success: false, error: 'Update is already downloading' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Interface />)
    await screen.findByText(/Running build:/)
    fireEvent.change(screen.getByRole('combobox', { name: 'Branch' }), { target: { value: 'nightly' } })
    expect((await screen.findByRole('alert')).textContent).toBe('Update is already downloading')
    expect(screen.getByRole('combobox', { name: 'Branch' }).value).toBe('patched')
  })

  it('clears the footer offer when the feed goes idle', async () => {
    bridge()
    const { result } = renderHook(() => useAppUpdate(vi.fn()), { wrapper: ToastProvider })
    act(() => result.current.handleUpdateStatus({ status: 'available', version: '0.9.9-patched.nightly.494.2' }))
    expect(result.current.appUpdateNotice.visible).toBe(true)
    act(() => result.current.handleUpdateStatus({ status: 'idle', branch: 'patched' }))
    expect(result.current.appUpdateNotice.visible).toBe(false)
    expect(result.current.appUpdateActionBusy).toBe(false)
  })

  // The upstream notice is news, not an update: it opens release notes and
  // records a receipt, and never touches the updater feed or the footer offer.
  it('restores a missed upstream notice, acknowledges it, and leaves the updater alone', async () => {
    const notice = { tag: 'v0.9.9-nightly.494', version: '0.9.9-nightly.494', count: 2, url: 'https://github.com/towerwatchman/Atlas/releases/tag/v0.9.9-nightly.494' }
    const api = bridge({ status: 'idle', branch: 'patched', upstreamNightly: notice })
    const { result } = renderHook(() => useAppUpdate(vi.fn()), { wrapper: ToastProvider })
    await screen.findByText('Upstream Nightly updated')
    expect(api.acknowledgeUpstreamNightly).toHaveBeenCalledWith(notice.tag)
    fireEvent.click(screen.getByRole('button', { name: 'Release notes' }))
    expect(api.openExternalUrl).toHaveBeenCalledWith(notice.url)
    expect(api.saveSettings).not.toHaveBeenCalled()
    expect(api.downloadAndInstallAppUpdate).not.toHaveBeenCalled()
    expect(result.current.appUpdateNotice.visible).toBe(false)
  })
})
