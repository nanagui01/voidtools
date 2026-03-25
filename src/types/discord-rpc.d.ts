declare module 'discord-rpc' {
  class Client {
    constructor(options: { transport: string })
    login(options: { clientId: string }): Promise<this>
    setActivity(activity: Record<string, unknown>): Promise<unknown>
    clearActivity(): Promise<unknown>
    destroy(): Promise<void>
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  function register(clientId: string): void

  export { Client, register }
  export default { Client, register }
}
