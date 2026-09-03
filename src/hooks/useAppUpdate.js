import { useState, useCallback, useEffect, useRef } from 'react'
import { formatPercent, sanitizePercentText } from '../utils/formatPercent.js'
import { useToast } from '../components/ui/toast/ToastContext.jsx'

const PACKAGE_NOT_READY_CODE = 'UPDATE_PACKAGE_NOT_READY'
const NO_RELEASE_ON_CHANNEL_CODE = 'UPDATE_NO_RELEASE_ON_CHANNEL'
const AUTO_DISMISS_NOTICE_MS = 15000
const AUTO_DISMISS_STATUSES = new Set(['available', 'not-available', 'error', 'package_not_ready'])

export function useAppUpdate(setDbUpdateStatus) {
  const toast = useToast()
  const shownNightly = useRef(null)
  const [appUpdateNotice, setAppUpdateNotice] = useState({
    visible: false,
    status: '',
    version: '',
    text: '',
    percent: null,
  })
  const [appUpdateActionBusy, setAppUpdateActionBusy] = useState(false)

  // Upstream news is a separate, sticky notice: its only action opens release
  // notes. It can never download anything or move the selected feed.
  useEffect(() => {
    let mounted = true
    const showNightly = (notice) => {
      if (!mounted || !notice?.tag || shownNightly.current === notice.tag) return
      shownNightly.current = notice.tag
      toast.info('Upstream Nightly updated', {
        id: 'upstream-nightly',
        message: `${notice.count > 1 ? `${notice.count} new releases. Latest: ` : ''}Atlas ${notice.version}. Your update branch is unchanged.`,
        action: { label: 'Release notes', onClick: () => window.electronAPI.openExternalUrl(notice.url) },
      })
      window.electronAPI.acknowledgeUpstreamNightly?.(notice.tag).catch((err) => console.warn('Could not save nightly receipt:', err))
    }
    const unsubscribe = window.electronAPI.onUpstreamNightlyAvailable?.(showNightly)
    window.electronAPI.getAppUpdateState?.().then((state) => showNightly(state?.upstreamNightly))
      .catch((err) => console.warn('Could not restore upstream notice:', err))
    return () => { mounted = false; unsubscribe?.() }
  }, [toast])

  useEffect(() => {
    if (!appUpdateNotice.visible || !AUTO_DISMISS_STATUSES.has(appUpdateNotice.status)) return undefined
    const timer = window.setTimeout(() => {
      setAppUpdateNotice((notice) => {
        if (!notice.visible || notice.status !== appUpdateNotice.status) return notice
        return { ...notice, visible: false }
      })
    }, AUTO_DISMISS_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [appUpdateNotice.visible, appUpdateNotice.status])

  const getFooterActionState = useCallback((status) => {
    if (status === 'installing') return { label: 'Installing update...', canInstallUpdate: true }
    if (status === 'downloaded') return { label: 'Install and restart', canInstallUpdate: true }
    if (status === 'downloading') return { label: 'Downloading...', canInstallUpdate: false }
    if (status === 'checking') return { label: 'Checking...', canInstallUpdate: false }
    if (['error', 'package_not_ready', 'not-available'].includes(status)) {
      return { label: 'Check for updates', canInstallUpdate: false }
    }
    return { label: 'Download and install', canInstallUpdate: false }
  }, [])

  const logFooterTransition = useCallback((previousStatus, nextStatus, source) => {
    const actionState = getFooterActionState(nextStatus)
    console.log(
      `update-state: ${previousStatus || 'idle'} -> ${nextStatus || 'idle'} via ${source}; ` +
      `footerAction=${actionState.label}; canInstallUpdate=${actionState.canInstallUpdate}`,
    )
  }, [getFooterActionState])

  const handleUpdateStatus = useCallback(
    (status) => {
      console.log('Update status:', status)
      if (status.status === 'idle') {
        // A channel change invalidates any offer from the previous feed, in
        // the footer too — otherwise its button still targets the old release.
        setAppUpdateActionBusy(false)
        setAppUpdateNotice({ visible: false, status: '', version: '', text: '', percent: null })
      } else if (status.status === 'available') {
        setAppUpdateActionBusy(false)
        setAppUpdateNotice((notice) => {
          logFooterTransition(notice.status, 'available', 'update-status')
          return {
          visible: true,
          status: 'available',
          version: status.version || '',
          text: sanitizePercentText(`Atlas ${status.version} is available.`),
          percent: null,
          }
        })
      } else if (status.status === 'downloading') {
        const percent = Number(status.percent || 0)
        const displayPercent = formatPercent(percent)
        setAppUpdateActionBusy(true)
        setDbUpdateStatus({
          text: `Downloading update: ${displayPercent}`,
          progress: percent,
          total: 100,
        })
        setAppUpdateNotice((notice) => {
          logFooterTransition(notice.status, 'downloading', 'update-status')
          return {
            ...notice,
            visible: true,
            status: 'downloading',
            version: status.version || notice.version || '',
            percent,
            text: status.version
              ? `Downloading Atlas ${status.version}: ${displayPercent}`
              : status.percent !== undefined && status.percent !== null
                ? `Downloading Atlas update: ${displayPercent}`
                : 'Downloading Atlas update...',
          }
        })
      } else if (status.status === 'downloaded') {
        setAppUpdateActionBusy(false)
        setDbUpdateStatus({ text: '', progress: 0, total: 0 })
        setAppUpdateNotice((notice) => {
          const version = status.version || notice.version || ''
          logFooterTransition(notice.status, 'downloaded', 'update-status')
          return {
            visible: true,
            status: 'downloaded',
            version,
            text: sanitizePercentText(`Atlas ${version || 'update'} is ready to install.`),
            percent: null,
          }
        })
      } else if (status.status === 'installing') {
        setAppUpdateActionBusy(true)
        setDbUpdateStatus({ text: '', progress: 0, total: 0 })
        setAppUpdateNotice((notice) => {
          const version = status.version || notice.version || ''
          logFooterTransition(notice.status, 'installing', 'update-status')
          return {
            visible: true,
            status: 'installing',
            version,
            text: 'Installing update...',
            percent: null,
          }
        })
      } else if (status.status === 'not-available') {
        setAppUpdateActionBusy(false)
        setAppUpdateNotice((notice) => {
          logFooterTransition(notice.status, 'not-available', 'update-status')
          return {
            visible: true,
            status: 'not-available',
            version: '',
            text: 'Atlas is up to date.',
            percent: null,
          }
        })
      } else if (status.status === 'error') {
        setAppUpdateActionBusy(false)
        // "No release on this channel yet" is a normal, expected state (e.g.
        // right after switching to a branch that has no build). Present it as a
        // benign, up-to-date-style notice rather than a red failure.
        if (status.code === NO_RELEASE_ON_CHANNEL_CODE) {
          setAppUpdateNotice((notice) => {
            logFooterTransition(notice.status, 'not-available', 'update-status')
            return {
              visible: true,
              status: 'not-available',
              code: status.code || '',
              version: '',
              text: sanitizePercentText(status.error || 'Atlas is up to date.'),
              percent: null,
            }
          })
          return
        }
        console.error('Update error:', status.error)
        setAppUpdateNotice((notice) => {
          const nextStatus = status.code === PACKAGE_NOT_READY_CODE ? 'package_not_ready' : 'error'
          logFooterTransition(notice.status, nextStatus, 'update-status')
          return {
            visible: true,
            status: nextStatus,
            code: status.code || '',
            version: '',
            text: sanitizePercentText(status.error || 'Update failed.'),
            percent: null,
          }
        })
      }
    },
    [logFooterTransition, setDbUpdateStatus]
  )

  const reconcileAppUpdateState = useCallback(async (source) => {
    const status = await window.electronAPI.getAppUpdateState?.()
    if (status?.status && status.status !== 'idle') {
      handleUpdateStatus(status)
      return status
    }
    return null
  }, [handleUpdateStatus])

  const handleAppUpdateAction = useCallback(async () => {
    if (appUpdateActionBusy) return
    try {
      setAppUpdateActionBusy(true)
      const latestStatus = await reconcileAppUpdateState('footer-action')
      const effectiveStatus = latestStatus?.status === 'downloaded'
        ? 'downloaded'
        : latestStatus?.status === 'installing'
          ? 'installing'
        : appUpdateNotice.status
      if (effectiveStatus === 'installing' || effectiveStatus === 'downloading' || effectiveStatus === 'checking') {
        return
      }
      if (
        effectiveStatus === 'error' ||
        effectiveStatus === 'package_not_ready' ||
        effectiveStatus === 'not-available'
      ) {
        setAppUpdateNotice((notice) => ({
          ...notice,
          status: 'checking',
          code: '',
          text: 'Checking for updates...',
          percent: null,
        }))
        const result = await window.electronAPI.checkAppUpdate()
        if (!result?.success) {
          if (result?.code === PACKAGE_NOT_READY_CODE) {
            setAppUpdateNotice({
              visible: true,
              status: 'package_not_ready',
              code: result.code,
              version: '',
              text: sanitizePercentText(result.error || 'Update package is not ready yet. Please try again in a few minutes.'),
              percent: null,
            })
            return
          }
          throw new Error(result?.error || 'Failed to check for updates')
        }
        return
      }

      if (effectiveStatus === 'downloaded') {
        const result = await window.electronAPI.installAppUpdate()
        if (!result?.success) {
          throw new Error(result?.error || 'Failed to update Atlas')
        }
        return
      }

      if (effectiveStatus === 'available') {
        const result = await window.electronAPI.downloadAndInstallAppUpdate()
        if (!result?.success) {
          if (result?.code === PACKAGE_NOT_READY_CODE) {
            setAppUpdateNotice({
              visible: true,
              status: 'package_not_ready',
              code: result.code,
              version: '',
              text: sanitizePercentText(result.error || 'Update package is not ready yet. Please try again in a few minutes.'),
              percent: null,
            })
            return
          }
          throw new Error(result?.error || 'Failed to update Atlas')
        }
        setAppUpdateNotice((notice) => ({
          ...notice,
          status: 'downloading',
          code: '',
          percent: null,
          text: notice.version
            ? `Downloading Atlas ${notice.version}...`
            : 'Downloading update...',
        }))
        await reconcileAppUpdateState('download-complete')
      }
    } catch (error) {
      console.error('App update action failed:', error)
      setAppUpdateNotice({
        visible: true,
        status: 'error',
        code: '',
        version: '',
        text: sanitizePercentText(error.message || 'App update failed.'),
        percent: null,
      })
    } finally {
      setAppUpdateActionBusy(false)
    }
  }, [appUpdateActionBusy, appUpdateNotice.status, reconcileAppUpdateState])

  return {
    appUpdateNotice,
    setAppUpdateNotice,
    appUpdateActionBusy,
    handleUpdateStatus,
    handleAppUpdateAction,
  }
}
