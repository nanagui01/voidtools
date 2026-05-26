import { spawn } from 'node:child_process'

const env = {
  ...process.env,
  FORCE_LOCAL_CHANGELOG: '1',
  VITE_FORCE_CHANGELOG: '1',
}

const isWindows = process.platform === 'win32'
const cmd = isWindows ? 'npm.cmd' : 'npm'
const args = ['run', 'dev:electron']

console.log('[changelog] Iniciando dev:electron com CHANGELOG.md local forçado...')

const child = spawn(cmd, args, {
  env,
  stdio: 'inherit',
  shell: isWindows,
})

child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  console.error('[changelog] Falha ao iniciar:', err)
  process.exit(1)
})
