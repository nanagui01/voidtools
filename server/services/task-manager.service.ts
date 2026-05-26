import { EventEmitter } from 'events'
import { logger } from '../core/logger'
import { generateId } from '../utils/helpers'
import type { ToolTask, ToolType, ToolStatus } from '../../src/types/tools'

/**
 * Gerenciador de tarefas assíncronas (ferramentas).
 * Controla ciclo de vida: criação, progresso, pausa, cancelamento e conclusão.
 * Emite eventos consumidos pelo WebSocket para atualizar o frontend
 */
class TaskManager extends EventEmitter {
  private tasks: Map<string, ToolTask> = new Map()
  private abortControllers: Map<string, AbortController> = new Map()

  createTask(tool: ToolType, config: Record<string, unknown>): ToolTask {
    const task: ToolTask = {
      id: generateId(),
      tool,
      status: 'idle',
      progress: 0,
      total: 0,
      startedAt: new Date().toISOString(),
      config,
      results: [],
    }
    this.tasks.set(task.id, task)
    this.emit('task:created', task)
    logger.info('TaskManager', `Task criada: ${task.id} [${tool}]`)
    return task
  }

  startTask(taskId: string): AbortController | null {
    const task = this.tasks.get(taskId)
    if (!task) return null

    const controller = new AbortController()
    this.abortControllers.set(taskId, controller)

    task.status = 'running'
    task.startedAt = new Date().toISOString()
    this.emit('task:started', task)
    logger.info('TaskManager', `Task iniciada: ${taskId}`)
    return controller
  }

  updateConfig(taskId: string, patch: Record<string, unknown>) {
    const task = this.tasks.get(taskId)
    if (!task) return
    task.config = { ...task.config, ...patch }
    this.emit('task:config', { taskId, config: task.config, tool: task.tool })
  }

  updateProgress(taskId: string, progress: number, total: number, message?: string, phase?: string, extra?: Record<string, unknown>) {
    const task = this.tasks.get(taskId)
    if (!task) return

    task.progress = progress
    task.total = total
    if (phase) (task as any).phase = phase
    if (extra) (task as any).extra = extra

    if (message) {
      task.results.push({
        timestamp: new Date().toISOString(),
        success: true,
        message,
      })
    }

    this.emit('task:progress', { taskId, progress, total, message, tool: task.tool, phase, ...extra })
  }

  completeTask(taskId: string) {
    const task = this.tasks.get(taskId)
    if (!task) return

    task.status = 'completed'
    task.completedAt = new Date().toISOString()
    this.abortControllers.delete(taskId)

    this.emit('task:completed', task)
    logger.success('TaskManager', `Task concluída: ${taskId} [${task.tool}]`)
  }

  failTask(taskId: string, error: string) {
    const task = this.tasks.get(taskId)
    if (!task) return

    task.status = 'error'
    task.error = error
    task.completedAt = new Date().toISOString()
    this.abortControllers.delete(taskId)

    this.emit('task:error', { taskId, error, tool: task.tool })
    logger.error('TaskManager', `Task falhou: ${taskId} - ${error}`)
  }

  cancelTask(taskId: string) {
    const controller = this.abortControllers.get(taskId)
    if (controller) {
      controller.abort()
    }

    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'cancelled'
      task.completedAt = new Date().toISOString()
      this.emit('task:cancelled', task)
      logger.warn('TaskManager', `Task cancelada: ${taskId}`)
    }

    this.abortControllers.delete(taskId)
  }

  pauseTask(taskId: string) {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'running') return
    task.status = 'paused'
    this.emit('task:paused', task)
  }

  resumeTask(taskId: string) {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'paused') return
    task.status = 'running'
    this.emit('task:resumed', task)
  }

  getTask(taskId: string): ToolTask | undefined {
    return this.tasks.get(taskId)
  }

  getAllTasks(): ToolTask[] {
    return Array.from(this.tasks.values())
  }

  getRunningTasks(): ToolTask[] {
    return this.getAllTasks().filter((t) => t.status === 'running' || t.status === 'paused')
  }

  getTasksByTool(tool: ToolType): ToolTask[] {
    return this.getAllTasks().filter((t) => t.tool === tool)
  }

  isAborted(taskId: string): boolean {
    const controller = this.abortControllers.get(taskId)
    return controller?.signal.aborted ?? true
  }

  clearCompleted() {
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'error' || task.status === 'cancelled') {
        this.tasks.delete(id)
      }
    }
  }
}

export const taskManager = new TaskManager()
