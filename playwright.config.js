const { defineConfig } = require('@playwright/test'),
  fs = require('fs'),
  os = require('os'),
  path = require('path');
const port = Number(process.env.UI_PORT || 43261),
  base = 'http://127.0.0.1:' + port,
  data = fs.mkdtempSync(path.join(os.tmpdir(), 'course-ui-'));
module.exports = defineConfig({
  testDir: 'tests/ui',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: base,
    viewport: { width: 1280, height: 900 },
    channel:
      process.env.UI_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node platform/server.js',
    url: base + '/api/health',
    reuseExistingServer: false,
    env: {
      APP_MODE: 'demo',
      AI_PROVIDER: 'mock',
      OPENAI_API_KEY: '',
      PUBLIC_ORIGIN: '',
      TRUST_PROXY: '',
      ALLOW_RESET: 'false',
      DATA_DIR: data,
      HOST: '127.0.0.1',
      PORT: String(port),
    },
  },
});
