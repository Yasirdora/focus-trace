import { defineConfig } from 'playwright/test';
export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers: 2,
  timeout: 15000,
  use: {
    browserName: 'chromium',
    ...(process.env.FOCUS_TRACE_CHANNEL ? { channel: process.env.FOCUS_TRACE_CHANNEL } : {}),
  },
  reporter: [['list']],
});
