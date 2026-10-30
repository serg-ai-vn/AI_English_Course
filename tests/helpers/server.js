'use strict';
const fs = require('fs'),
  os = require('os'),
  path = require('path'),
  cp = require('child_process');
async function startServer(overrides = {}) {
  const data = overrides.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'course-test-'));
  const env = {
    ...process.env,
    APP_MODE: 'demo',
    AI_PROVIDER: 'mock',
    OPENAI_API_KEY: '',
    PUBLIC_ORIGIN: '',
    TRUST_PROXY: '',
    ALLOW_RESET: 'false',
    HOST: '127.0.0.1',
    PORT: '0',
    DATA_DIR: data,
    ...overrides,
  };
  const child = cp.spawn(process.execPath, ['platform/server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Test server startup timeout'));
    }, 15000);
    let buffer = '';
    child.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once('exit', (c) => {
      clearTimeout(timer);
      reject(new Error('Test server exited ' + c));
    });
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      const m = /Platform ready on (http:\/\/[^\s]+)/.exec(buffer);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
  });
  return {
    base,
    data,
    async stop() {
      if (child.exitCode !== null) return;
      await new Promise((r) => {
        child.once('exit', r);
        child.kill();
      });
    },
  };
}
module.exports = { startServer };
