const { startServer } = require('../tests/helpers/server');
(async () => {
  const server = await startServer();
  try {
    const routes = ['/api/health', '/login.html', '/workspace.html', '/teacher.html', '/platform.css', '/app.js', '/teacher.js', '/ui-theme.js', '/workspace-ui.js', '/prompt-validation.js'];
    for (const p of routes) {
      const r = await fetch(server.base + p);
      if (r.status !== 200) throw new Error(p + ' ' + r.status);
      if (p.endsWith('.js') && !/javascript/.test(r.headers.get('content-type'))) throw new Error('Wrong MIME ' + p);
      if (p.endsWith('.html') && !(await r.text()).includes('data-ui-theme="classroom-light"')) throw new Error('Missing theme ' + p);
    }
    for (const p of ['/server.js', '/ui-theme.js/../server.js', '/data/classes.json', '/.env', '/validate.js']) {
      const r = await fetch(server.base + p);
      if (r.status === 200) throw new Error('Private path exposed: ' + p);
    }
    console.log('Isolated HTTP smoke: 10 routes + 5 private paths PASS');
  } finally {
    await server.stop();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
