import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProd = mode === 'production'
  const isTest = process.env.VITEST === 'true' || mode === 'test'

  if (isProd && !isTest) {
    const apiUrl = env.VITE_API_URL || process.env.VITE_API_URL
    if (!apiUrl) {
      if (process.env.VERCEL || process.env.CI || process.env.STRICT_API_URL === 'true') {
        throw new Error(
          '\n[Vite Build Error] VITE_API_URL environment variable is required for production builds on Vercel/CI.\n' +
          'Please configure VITE_API_URL in your deployment environment variables.\n'
        )
      } else {
        console.warn(
          '\n⚠️  [Vite Build Warning] VITE_API_URL is not set for production build.\n' +
          'Production builds will not have an API URL configured unless VITE_API_URL is provided.\n'
        )
      }
    }
  }

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/test/**/*.{test,spec}.{ts,tsx}'],
    },
  }
})
