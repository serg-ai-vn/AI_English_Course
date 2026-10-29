'use strict';
const cp = require('child_process'),
  crypto = require('crypto'),
  path = require('path'),
  assert = require('node:assert/strict');
const id = 'course-check-' + crypto.randomBytes(6).toString('hex'),
  image = id,
  volume = id + '-data',
  container = id + '-app';
function docker(args) {
  const r = cp.spawnSync('docker', args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 10000000,
  });
  if (r.status !== 0)
    throw new Error('Docker ' + args[0] + ' failed: ' + (r.stderr || r.error?.message || ''));
  return r.stdout.trim();
}
async function launch() {
  docker([
    'run',
    '-d',
    '--name',
    container,
    '-e',
    'APP_MODE=demo',
    '-e',
    'AI_PROVIDER=mock',
    '-e',
    'PORT=4000',
    '-e',
    'HOST=0.0.0.0',
    '-e',
    'DATA_DIR=/data',
    '-p',
    '127.0.0.1::4000',
    '-v',
    volume + ':/data',
    image,
  ]);
  const base = 'http://' + docker(['port', container, '4000/tcp']);
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + '/api/health')).ok) return base;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Container health timeout');
}
(async () => {
  docker(['build', '-t', image, '.']);
  docker(['volume', 'create', volume]);
  try {
    let base = await launch();
    let r = await fetch(base + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ classCode: 'DEMO', name: 'Neo', pin: '3333' }),
    });
    assert.equal(r.status, 200);
    const token = (await r.json()).token;
    r = await fetch(base + '/api/save-direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: base,
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ field: 'site-title', text: 'Container persistence' }),
    });
    assert.equal((await r.json()).ok, true);
    docker(['rm', '-f', container]);
    base = await launch();
    const me = await (
      await fetch(base + '/api/me', { headers: { Authorization: 'Bearer ' + token } })
    ).json();
    assert.equal(me.progress.fields['site-title'].value, 'Container persistence');
    console.log(
      'Docker Node24, nondefault PORT4000, session/progress after container recreation: PASS',
    );
  } finally {
    for (const args of [
      ['rm', '-f', container],
      ['volume', 'rm', volume],
      ['image', 'rm', image],
    ])
      try {
        docker(args);
      } catch {}
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
