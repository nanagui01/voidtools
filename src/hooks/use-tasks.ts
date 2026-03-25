'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { useWSEvent } from './use-websocket'
import type { ToolTask } from '@/types/tools'
import type { WSToolProgress, WSToolCompleted, WSToolError } from '@/types/websocket'

/**
 * Hook que gerencia o estado das tarefas em tempo real.
 * Sincroniza com WebSocket para progresso, conclusão e erros
 */
export function useTasks() {
  const [tasks, setTasks] = useState<ToolTask[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.getTasks()
      setTasks((res.data || []) as ToolTask[])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useWSEvent<WSToolProgress>('tool:progress', (data) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === data.taskId
          ? { ...t, progress: data.progress, total: data.total, status: 'running' }
          : t
      )
    )
  })

  useWSEvent<WSToolCompleted>('tool:completed', (data) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === data.taskId ? { ...t, status: 'completed', results: data.results } : t
      )
    )
  })

  useWSEvent<WSToolError>('tool:error', (data) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === data.taskId ? { ...t, status: 'error', error: data.error } : t
      )
    )
  })

  const runTool = useCallback(async (tool: string, config: unknown) => {
    const res = await api.runTool(tool, config)
    await fetchTasks()
    return res
  }, [fetchTasks])

  const cancelTask = useCallback(async (id: string) => {
    await api.cancelTask(id)
    await fetchTasks()
  }, [fetchTasks])

  const clearCompleted = useCallback(async () => {
    await api.clearCompletedTasks()
    await fetchTasks()
  }, [fetchTasks])

  const runningTasks = tasks.filter((t) => t.status === 'running' || t.status === 'paused')

  return {
    tasks,
    runningTasks,
    loading,
    runTool,
    cancelTask,
    clearCompleted,
    refetch: fetchTasks,
  }
}
