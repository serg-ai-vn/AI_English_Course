const { defineConfig } = require('@playwright/test'),
  fs = require('fs'),
  os = require('os'),
  path = require('path');
const port = Number(process.env.UI_PORT || 43261),
  base = 'http://127.0.0.1:' + port,
  themes = ['classroom-light', 'night-lab'];
function fixtureData(theme) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'course-ui-' + theme + '-'));
  fs.cpSync(path.join(__dirname, 'fixtures'), data, { recursive: true });
  // Nia resumes a synthetic pilot-1 profile after L2, with all subsequent work
  // performed through browser controls. Never reads or modifies owner data.
  const profile = JSON.parse(fs.readFileSync(path.join(data, 'progress/lumi.json')));
  const l2 = new Set(require('./platform/config/lesson-2.json').fields.map(f => f.id));
  profile.studentId = 'nia';
  profile.lesson = 3;
  profile.complete = false;
  profile.unlockedLessons = [2, 3];
  profile.fields = Object.fromEntries(Object.entries(profile.fields).filter(([id]) => l2.has(id)));
  delete profile.built;
  delete profile.published;
  fs.writeFileSync(path.join(data, 'progress/nia.json'), JSON.stringify(profile));
  return data;
}
module.exports = defineConfig({
  testDir: 'tests/ui',
  workers: 1,
  timeout: 60000,
  projects: themes.map((theme, index) => ({
    name: theme,
    metadata: { theme },
    use: { baseURL: 'http://127.0.0.1:' + (port + index) },
  })),
  use: {
    baseURL: base,
    viewport: { width: 1280, height: 900 },
    channel:
      process.env.UI_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: themes.map((theme, index) => ({
    command: 'node platform/server.js',
    url: 'http://127.0.0.1:' + (port + index) + '/api/health',
    reuseExistingServer: false,
    env: {
      APP_MODE: 'demo',
      AI_PROVIDER: 'mock',
      OPENAI_API_KEY: '',
      PUBLIC_ORIGIN: '',
      TRUST_PROXY: '',
      ALLOW_RESET: 'false',
      DATA_DIR: fixtureData(theme),
      HOST: '127.0.0.1',
      PORT: String(port + index),
    },
  })),
});
