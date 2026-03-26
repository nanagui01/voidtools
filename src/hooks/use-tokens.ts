'use client'

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { api } from '@/lib/api-client'
import type { TokenInfo } from '@/types/discord'

let _tokens: TokenInfo[] = []
let _activeTokenId: string | null = null
let _loading = true
let _connecting = false
let _autoConnectLock = false
let _fetchLock = false
const _listeners = new Set<() => void>()
let _version = 0

function notify() {
  _version++
  _listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  _listeners.add(listener)
  return () => { _listeners.delete(listener) }
}

function getSnapshot() {
  return _version
}

async function _fetchTokens() {
  if (_fetchLock) {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (!_fetchLock) { resolve(); return }
        setTimeout(check, 100)
      }
      setTimeout(check, 100)
    })
    return
  }
  _fetchLock = true
  try {
    const res = await api.getTokens()
    const data = (res.data || []) as TokenInfo[]
    _tokens = data
    if (!_activeTokenId && data.length > 0) {
      _activeTokenId = data[0].id
    }

    if (data.length > 0) {
      const active = await api.getActiveToken().catch(() => null)
      const activeData = active?.data as { connected: boolean; tokenId?: string } | undefined
      if (activeData?.connected && activeData.tokenId) {
        _activeTokenId = activeData.tokenId
      } else if (!_initialFetchDone && !_autoConnectLock) {
        _autoConnectLock = true
        const tokenToConnect = data[0].id
        api.connectToken(tokenToConnect)
          .catch(() => {})
          .finally(() => { _autoConnectLock = false })
      }
    }
  } catch {
  } finally {
    _loading = false
    _fetchLock = false
    _initialFetchDone = true
    notify()
  }
}

let _initialFetchDone = false

export function useTokens() {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (!_initialFetchDone) {
      _fetchTokens()
    }
  }, [])

  const fetchTokens = useCallback(async () => {
    await _fetchTokens()
  }, [])

  const addToken = useCallback(async (label: string, token: string) => {
    const res = await api.addToken(label, token)
    await _fetchTokens()
    return res.data as TokenInfo
  }, [])

  const removeToken = useCallback(async (id: string) => {
    await api.removeToken(id)
    if (_activeTokenId === id) {
      _activeTokenId = null
      notify()
    }
    await _fetchTokens()
  }, [])

  const checkToken = useCallback(async (id: string) => {
    await api.checkToken(id)
    await _fetchTokens()
  }, [])

  const switchAccount = useCallback(async (id: string) => {
    const prevId = _activeTokenId
    _activeTokenId = id
    _connecting = true
    notify()
    try {
      await api.switchToken(id)
    } catch (err) {
      _activeTokenId = prevId
      notify()
      throw err
    } finally {
      _connecting = false
      notify()
    }
  }, [])

  const activeToken = _tokens.find((t) => t.id === _activeTokenId) || null

  return {
    tokens: _tokens,
    loading: _loading,
    connecting: _connecting,
    activeToken,
    activeTokenId: _activeTokenId,
    setActiveTokenId: (id: string | null) => { _activeTokenId = id; notify() },
    switchAccount,
    addToken,
    removeToken,
    checkToken,
    refetch: fetchTokens,
  }
}
