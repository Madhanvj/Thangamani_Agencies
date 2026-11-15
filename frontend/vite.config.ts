import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

function readPort(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback
  const port = Number(value)
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`)
  }
  return port
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, ['FRONTEND_PORT', 'BACKEND_PORT'])
  const frontendPort = readPort(env.FRONTEND_PORT, 5173, 'FRONTEND_PORT')
  const backendPort = readPort(env.BACKEND_PORT, 8001, 'BACKEND_PORT')
  return {
    preview: { port: frontendPort, strictPort: true },
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: frontendPort,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
