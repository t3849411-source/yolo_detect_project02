import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:15173',
    channel: 'chrome',
    headless: true,
  },
  webServer: [
    {
      command: 'env MODEL_WARMUP=false CORS_ORIGINS=http://127.0.0.1:15173 ../server/.venv/bin/uvicorn --app-dir ../server app.main:app --host 127.0.0.1 --port 18001',
      url: 'http://127.0.0.1:18001/health',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'env VITE_API_BASE_URL=http://127.0.0.1:18001 npm run dev -- --host 127.0.0.1 --port 15173',
      url: 'http://127.0.0.1:15173',
      timeout: 30_000,
      reuseExistingServer: false,
    },
  ],
})
