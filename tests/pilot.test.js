'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  path = require('path'),
  os = require('os'),
  cp = require('child_process');
const { startServer } = require('./helpers/server');
const network = require('../platform/network-policy');
test('pilot: real HTTP Origin, cookie-only session, no shared NAT throttle, per-account failure protection', async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'course-pilot-'));
  fs.writeFileSync(
    path.join(data, 'classes.json'),
    JSON.stringify({
      classes: [
        {
          code: 'PILOT-A',
          name: 'Pilot fixture',
          teacherPin: '975310',
          students: Array.from({ length: 15 }, (_, i) => ({
            id: 'student-' + i,
            name: 'Learner' + i,
            pin: '864200',
          })),
        },
      ],
    }),
  );
  const server = await startServer({
    DATA_DIR: data,
    APP_MODE: 'pilot',
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-only-never-used',
    TEACHER_PIN_PILOT_A: '975311',
  });
  try {
    const call = (route, body, headers = {}) =>
      fetch(server.base + route, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Origin: server.base, ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
    let r = await call('/api/login', { role: 'teacher', classCode: 'PILOT-A', pin: '975311' });
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie');
    assert(!cookie.includes('Secure'));
    assert(cookie.includes('HttpOnly'));
    r = await call('/api/teacher/overview', null, { Cookie: cookie.split(';')[0] });
    assert.equal(r.status, 200);
    r = await call(
      '/api/login',
      { role: 'teacher', classCode: 'PILOT-A', pin: '975311' },
      { Origin: 'http://other.invalid' },
    );
    assert.equal(r.status, 403);
    const tokens = [];
    for (let i = 0; i < 15; i++) {
      r = await call('/api/login', { classCode: 'PILOT-A', name: 'Learner' + i, pin: '864200' });
      assert.equal(r.status, 200);
      tokens.push((await r.json()).token);
    }
    let successes = 0;
    for (const token of tokens)
      for (let i = 0; i < 20; i++) {
        r = await call('/api/me', null, { Authorization: 'Bearer ' + token });
        assert.equal(r.status, 200);
        successes++;
      }
    assert.equal(successes, 300);
    for (let i = 0; i < 10; i++) {
      r = await call('/api/login', { classCode: 'PILOT-A', name: 'Learner0', pin: 'bad' });
      assert.equal(r.status, 401);
    }
    r = await call('/api/login', { classCode: 'PILOT-A', name: 'Learner0', pin: 'bad' });
    assert.equal(r.status, 429);
    r = await call('/api/login', { classCode: 'PILOT-A', name: 'Learner1', pin: '864200' });
    assert.equal(r.status, 200);
    const health = await (await call('/api/health')).json();
    assert.equal(health.ok, true);
    assert.equal(health.liveChecked, false);
  } finally {
    await server.stop();
  }
});
test('transport: declared HTTPS origin and explicitly trusted proxy; forged forwarded header ignored', () => {
  const env = { ...process.env };
  try {
    delete process.env.PUBLIC_ORIGIN;
    delete process.env.TRUST_PROXY;
    const req = {
      headers: { host: 'example.test', 'x-forwarded-proto': 'https' },
      socket: { remoteAddress: '203.0.113.3' },
    };
    assert.equal(network.secure(req), false);
    process.env.TRUST_PROXY = 'loopback';
    assert.equal(network.secure(req), false);
    req.socket.remoteAddress = '127.0.0.1';
    assert.equal(network.secure(req), true);
    process.env.PUBLIC_ORIGIN = 'https://course.example.test';
    assert.equal(network.expectedOrigin(req), 'https://course.example.test');
    assert(
      network.originAllowed({
        ...req,
        headers: { ...req.headers, origin: process.env.PUBLIC_ORIGIN },
      }),
    );
    assert(
      !network.originAllowed({ ...req, headers: { ...req.headers, origin: 'https://other.test' } }),
    );
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env);
  }
});
test('backup CLI: usage without stack, nonempty destination and corrupt snapshot rejected', () => {
  const root = path.resolve(__dirname, '..'),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-cli-')),
    data = path.join(dir, 'data'),
    snapshot = path.join(dir, 'snapshot');
  fs.mkdirSync(data);
  fs.writeFileSync(path.join(data, 'classes.json'), '{}');
  const run = (args, d = data) =>
    cp.spawnSync(process.execPath, ['tools/backup.js', ...args], {
      cwd: root,
      env: { ...process.env, DATA_DIR: d, APP_MODE: 'demo', AI_PROVIDER: 'mock' },
      encoding: 'utf8',
    });
  let p = run(['backup']);
  assert.equal(p.status, 1);
  assert.match(p.stderr, /Usage:/);
  assert(!p.stderr.includes('at main'));
  p = run(['backup', snapshot]);
  assert.equal(p.status, 0, p.stderr);
  p = run(['restore', snapshot]);
  assert.equal(p.status, 1);
  assert.match(p.stderr, /NEW empty/);
  fs.appendFileSync(path.join(snapshot, 'classes.json'), 'broken');
  p = run(['restore', snapshot], path.join(dir, 'restored'));
  assert.equal(p.status, 1);
  assert.match(p.stderr, /Checksum/);
  assert(!fs.existsSync(path.join(dir, 'restored')));
});

test('HTTP provider failure preserves progress and provides an actionable 503; L1 is teacher-only and class-scoped', async () => {
  const preload = path.resolve(__dirname, 'helpers/unavailable-provider.js').replace(/\\/g, '/');
  const server = await startServer({
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-only',
    NODE_OPTIONS: '--require "' + preload + '"',
  });
  try {
    const call = (route, body, token) =>
      fetch(server.base + route, {
        method: body ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          Origin: server.base,
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    let r = await call('/api/login', { classCode: 'DEMO', name: 'Neo', pin: '3333' });
    const student = (await r.json()).token;
    const before = fs.readFileSync(path.join(server.data, 'progress/neo.json'), 'utf8');
    r = await call(
      '/api/prompt',
      {
        field: 'about-me',
        prompt:
          'Role: a creative student. Context: I have played football for years. Task: an energetic introduction. Format: paragraph.',
      },
      student,
    );
    assert.equal(r.status, 503);
    const error = await r.json();
    assert.equal(error.code, 'provider_model_unavailable');
    assert(error.errors[0].hint.includes('teacher'));
    assert.equal(fs.readFileSync(path.join(server.data, 'progress/neo.json'), 'utf8'), before);
    assert.equal((await (await call('/api/health')).json()).liveChecked, false);
    r = await call('/api/teacher/l1-ready', { studentId: 'neo', ready: true }, student);
    assert.equal(r.status, 403);
    r = await call('/api/login', { role: 'teacher', classCode: 'DEMO', pin: '0000' });
    const teacher = (await r.json()).token;
    r = await call('/api/teacher/l1-ready', { studentId: 'not-in-class', ready: true }, teacher);
    assert.equal(r.status, 400);
    r = await call('/api/teacher/l1-ready', { studentId: 'neo', ready: 'true' }, teacher);
    assert.equal(r.status, 400);
    r = await call('/api/teacher/unlock-lesson', { studentId: 'neo', lesson: 2 }, teacher);
    const unlock = await r.json();
    assert.equal(unlock.ok, true);
    assert(unlock.warning);
    r = await call('/api/teacher/l1-ready', { studentId: 'neo', ready: true }, teacher);
    assert.equal(r.status, 200);
    r = await call('/api/teacher/overview', null, teacher);
    assert((await r.json()).students.find((s) => s.id === 'neo').l1Ready);
  } finally {
    await server.stop();
  }
});
