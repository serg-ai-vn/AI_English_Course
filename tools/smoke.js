const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
(async () => {
  for (const p of ['/api/health', '/workspace.html', '/platform.css', '/app.js']) {
    const r = await fetch(base + p);
    if (r.status !== 200) throw new Error(p + ' ' + r.status);
  }
  console.log('4/4 routes passed');
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
