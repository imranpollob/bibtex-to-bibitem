import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:4173/bibtex-to-bibitem/', browserName: 'chromium' },
  webServer: { command: 'node scripts/serve-test.js', port: 4173, reuseExistingServer: false },
});
