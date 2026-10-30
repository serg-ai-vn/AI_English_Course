const { startServer } = require('../tests/helpers/server');
(async () => {
  const server = await startServer();
  try {
    for (const p of ['/api/health', '/workspace.html', '/platform.css', '/app.js']) {
      const r = await fetch(server.base + p);
      if (r.status !== 200) throw new Error(p + ' ' + r.status);
    }
    console.log('Isolated HTTP smoke: 4/4 PASS');
  } finally {
    await server.stop();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
