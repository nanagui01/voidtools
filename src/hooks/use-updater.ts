import { useState, useEffect, useCallback } from 'react'

export type UpdaterStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseNotes?: string }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
  | { status: 'dev' }

export function useUpdater() {
  const [status, setStatus] = useState<UpdaterStatus>({ status: 'idle' })
  const [isPackaged, setIsPackaged] = useState(true)

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.updater) return

    api.updater.isPackaged().then(setIsPackaged)

    const unsub = api.updater.onStatus((s: any) => {
      switch (s.status) {
        case 'checking':
          setStatus({ status: 'checking' })
          break
        case 'available':
          setStatus({
            status: 'available',
            version: s.info?.version ?? '?',
            releaseNotes: typeof s.info?.releaseNotes === 'string' ? s.info.releaseNotes : undefined,
          })
          break
        case 'not-available':
          setStatus({ status: 'not-available' })
          break
        case 'downloading':
          setStatus({
            status: 'downloading',
            percent: s.percent,
            bytesPerSecond: s.bytesPerSecond,
            transferred: s.transferred,
            total: s.total,
          })
          break
        case 'downloaded':
          setStatus({ status: 'downloaded', version: s.info?.version ?? '?' })
          break
        case 'error':
          setStatus({ status: 'error', message: s.message })
          break
      }
    })

    return unsub
  }, [])

  const checkForUpdates = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.updater) return

    if (!isPackaged) {
      setStatus({ status: 'dev' })
      return
    }

    setStatus({ status: 'checking' })
    await api.updater.check()
  }, [isPackaged])

  const downloadUpdate = useCallback(() => {
    window.electronAPI?.updater.download()
  }, [])

  const installUpdate = useCallback(() => {
    window.electronAPI?.updater.install()
  }, [])

  const openReleases = useCallback(() => {
    window.electronAPI?.updater.openReleases()
  }, [])

  return {
    status,
    isPackaged,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    openReleases,
  }
}
