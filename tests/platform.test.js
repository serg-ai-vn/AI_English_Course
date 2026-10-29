'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  os = require('os'),
  path = require('path'),
  cp = require('child_process'),
  http = require('http');
const root = path.join(__dirname, '..'),
  v = require('../platform/validate'),
  builder = require('../tools/site-builder'),
  storage = require('../platform/storage');
const cfg = (n) => JSON.parse(fs.readFileSync(path.join(root, `platform/config/lesson-${n}.json`)));
const prompt =
  'Role: a creative student. Context: I have played football for three years. Task: Write an energetic introduction. Format: one paragraph.';
function request(base, url, body, token) {
  return new Promise((resolve, reject) => {
    const address = new URL(base);
    const req = http.request(
      {
        hostname: address.hostname,
        port: address.port,
        path: url,
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          resolve({ status: res.statusCode, data, headers: res.headers });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('Timeout')));
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}
test('grammar, label contents and image acceptance', () => {
  for (const s of [
    'I have fed my dog.',
    'She has led the team.',
    "I've had my dog for two years.",
    'I have not ever played chess.',
  ])
    assert.equal(v.hasPresentPerfect(s, cfg(2).rules.v3verbs), true, s);
  for (const s of ['I have red shoes.', 'I have a red bed.'])
    assert.equal(v.hasPresentPerfect(s, cfg(2).rules.v3verbs), false, s);
  assert.equal(
    v.checkPrompt(
      'Role: Context: I have played football. Task: energetic creative Format:',
      [],
      cfg(2),
      cfg(2).fields.find((f) => f.id === 'about-me'),
    ).ok,
    false,
  );
  assert.equal(
    v.canAcceptImageField([{ best: { reason: 'a' } }, { worst: { reason: 'b' } }, {}], cfg(3)).ok,
    false,
  );
  for (const p of cfg(4).presets) {
    const w = p.moodWords[0];
    assert(
      v.checkThemePrompt({
        cfg: cfg(4),
        prompt: `Role: designer Context: I love art Task: choose theme Format: ${w}`,
      }).ok,
    );
    assert.equal(v.matchThemePreset(w, cfg(4)).id, p.id);
  }
});
test('corrupt storage is preserved and backup restores bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-storage-')),
    data = path.join(dir, 'data'),
    backup = path.join(dir, 'snapshot'),
    restore = path.join(dir, 'restore');
  fs.mkdirSync(data);
  storage.writeJson(path.join(data, 'classes.json'), { classes: [] });
  storage.writeJson(path.join(data, 'example.json'), { x: 1 });
  let p = cp.spawnSync(process.execPath, ['tools/backup.js', 'backup', backup], {
    cwd: root,
    env: { ...process.env, DATA_DIR: data },
    encoding: 'utf8',
  });
  assert.equal(p.status, 0, p.stderr);
  p = cp.spawnSync(process.execPath, ['tools/backup.js', 'restore', backup], {
    cwd: root,
    env: { ...process.env, DATA_DIR: restore },
    encoding: 'utf8',
  });
  assert.equal(p.status, 0, p.stderr);
  assert.deepEqual(storage.readJson(path.join(restore, 'example.json')), { x: 1 });
  fs.writeFileSync(path.join(data, 'bad.json'), '{');
  assert.throws(() => storage.readJson(path.join(data, 'bad.json'), {}));
  assert.equal(fs.readFileSync(path.join(data, 'bad.json'), 'utf8'), '{');
});
test('complete L2-L5 flow, permissions, corrections, export and restart', async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'course-e2e-'));
  const env = {
    ...process.env,
    DATA_DIR: data,
    APP_MODE: 'demo',
    AI_PROVIDER: 'mock',
    HOST: '127.0.0.1',
    PORT: '43217',
    ALLOW_RESET: 'false',
  };
  let child,
    base = 'http://127.0.0.1:43217';
  async function start() {
    child = cp.spawn(process.execPath, ['platform/server.js'], {
      cwd: root,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.stdout.once('data', resolve);
      child.stderr.once('data', (e) => reject(new Error(String(e))));
      child.once('exit', (c) => {
        if (c) reject(new Error('Server exit ' + c));
      });
    });
  }
  async function stop() {
    if (child.exitCode !== null) return;
    const exit = new Promise((r) => child.once('exit', r));
    child.kill();
    await exit;
  }
  const call = (url, body, token) => request(base, url, body, token),
    ok = async (url, body, token) => {
      const r = await call(url, body, token);
      assert.equal(r.status, 200, url + JSON.stringify(r.data));
      assert.equal(r.data.ok, true, url + JSON.stringify(r.data));
      return r.data;
    };
  try {
    await start();
    const teacher = (await call('/api/login', { classCode: 'DEMO', pin: '0000', role: 'teacher' }))
        .data.token,
      student = (await call('/api/login', { classCode: 'DEMO', name: 'Ziggy', pin: '2222' })).data
        .token;
    assert(teacher && student);
    for (const p of ['/workspace.html', '/platform.css', '/app.js', '/api/health'])
      assert.equal((await call(p)).status, 200);
    for (const p of [
      '/preview/platform/data/sessions.json',
      '/preview/platform/data/classes.json',
      '/preview/platform/server.js',
      '/preview/.env',
      '/preview/%2e%2e/server.js',
    ])
      assert.equal((await call(p)).status, 403, p);
    assert.equal(
      (
        await call(
          '/api/save-direct',
          { field: 'reflection-1', value: 'word '.repeat(16) },
          student,
        )
      ).status,
      403,
    );
    assert.equal((await call('/api/teacher/overview', undefined, student)).status, 403);
    assert.equal((await call('/api/reset-all', {}, student)).status, 403);
    assert.equal((await call('/api/login', '{')).status, 400);
    assert.equal((await call('/api/health')).status, 200);
    for (const f of cfg(2).fields.filter((f) => f.input === 'direct'))
      await ok(
        '/api/save-direct',
        { field: f.id, value: f.id === 'site-title' ? 'My <creative> site' : f.id + ' text' },
        student,
      );
    await ok('/api/prompt', { field: 'about-me', prompt }, student);
    assert.equal(
      (
        await call(
          '/api/prompt',
          { field: 'about-me', prompt: prompt + ' extra details for you' },
          student,
        )
      ).data.ok,
      false,
    );
    await ok(
      '/api/save-eval',
      { field: 'about-me', good: 'clear words', needsChange: 'more personal style' },
      student,
    );
    const d = await ok(
      '/api/prompt',
      { field: 'about-me', prompt: prompt + ' Keep the language clear.' },
      student,
    );
    await ok(
      '/api/save-eval',
      { field: 'about-me', good: 'clear useful words', needsChange: 'I will polish punctuation' },
      student,
    );
    await ok('/api/submit-text', { field: 'about-me', text: d.draft + ' Hello!' }, student);
    for (let i = 1; i <= 3; i++) {
      const d = await ok('/api/prompt', { field: 'hobby-text-' + i, prompt }, student);
      await ok('/api/submit-text', { field: 'hobby-text-' + i, text: d.draft }, student);
    }
    await ok('/api/teacher/unlock-lesson', { studentId: 'ziggy', lesson: 3 }, teacher);
    const image = (field, n) => ({
      field,
      prompt: `Subject: a fictional ${field}. Style: concept art. Framing: close-up. Lighting: soft light number ${n}.`,
    });
    for (const field of ['avatar', 'background']) {
      for (let n = 1; n <= 3; n++) {
        await ok('/api/image-prompt', image(field, n), student);
        assert.equal((await call('/api/image-prompt', image(field, n + 1), student)).status, 409);
        await ok(
          '/api/image-eval',
          { field, pros: 'I like the style', cons: 'I want softer light' },
          student,
        );
      }
      await ok('/api/image-best', { field, iteration: 0, reason: 'clear best result' }, student);
      await ok('/api/image-worst', { field, iteration: 1, reason: 'less suitable light' }, student);
      await ok('/api/image-accept', { field }, student);
    }
    await ok('/api/teacher/unlock-lesson', { studentId: 'ziggy', lesson: 4 }, teacher);
    for (let i = 1; i <= 3; i++) {
      const field = 'hobby-image-' + i;
      await ok('/api/image-prompt', image(field, 1), student);
      assert.equal(
        (await call('/api/image-prompt', { ...image(field, 2), __regenerate: true }, student))
          .status,
        409,
      );
      assert.equal((await call('/api/image-regenerate', image(field, 2), student)).data.ok, false);
      await ok(
        '/api/image-regenerate',
        { ...image(field, 2), reason: 'I want softer light' },
        student,
      );
      await ok('/api/image-publish', { field, version: 1 }, student);
    }
    const theme = (word) =>
      `Role: designer Context: My site shows hobbies Task: suggest theme Format: ${word}`;
    await ok('/api/theme-prompt', { field: 'theme', prompt: theme('natural') }, student);
    await ok('/api/theme-second', { field: 'theme', prompt: theme('mysterious') }, student);
    await ok('/api/theme-choose', { field: 'theme', choice: 1 }, student);
    await ok(
      '/api/theme-justify',
      { field: 'theme', text: 'This theme is calmer than the other theme.' },
      student,
    );
    const built = await ok('/api/teacher/build-site', { studentId: 'ziggy' }, teacher);
    assert.equal((await call('/preview/dist/ziggy.html')).status, 403);
    assert.equal((await call('/preview/dist/ziggy.html', undefined, teacher)).status, 200);
    const exported = JSON.parse(fs.readFileSync(path.join(data, 'ziggy-export.json')));
    for (const key of ['about-me', 'hobby-text-1', 'hobby-text-2', 'hobby-text-3'])
      assert(exported.slots[key]);
    assert.equal(exported.theme, 'forest-explorer');
    await ok('/api/teacher/unlock-lesson', { studentId: 'ziggy', lesson: 5 }, teacher);
    await ok(
      '/api/save-direct',
      { field: 'audit', items: { data: true, hallucination: true } },
      student,
    );
    for (let i = 1; i <= 6; i++)
      await ok(
        '/api/save-direct',
        {
          field: 'reflection-' + i,
          value:
            'I learned how to change my prompt and create a better presentation for my family today.',
        },
        student,
      );
    const published = await ok('/api/teacher/export-site', { studentId: 'ziggy' }, teacher);
    assert.equal((await call(published.url)).status, 200);
    assert.match(
      (await call(published.url + '?download=1')).headers['content-disposition'],
      /attachment/,
    );
    assert.equal(
      (
        await call(
          '/api/correct-field',
          { field: 'about-me', text: d.draft + ' Hi!', reason: 'remove a wrong fact' },
          student,
        )
      ).data.ok,
      false,
    );
    await ok(
      '/api/teacher/allow-correction',
      { studentId: 'ziggy', field: 'about-me', reason: 'Final audit correction' },
      teacher,
    );
    await ok(
      '/api/correct-field',
      { field: 'about-me', text: d.draft + ' Hi!', reason: 'remove a wrong fact' },
      student,
    );
    const p = JSON.parse(fs.readFileSync(path.join(data, 'progress/ziggy.json')));
    assert.equal(p.fields['about-me'].iterations.length, 2);
    assert.equal(p.fields['about-me'].corrections.length, 1);
    assert(!p.published && !p.built && !p.fields.audit);
    assert.equal((await call(published.url)).status, 404);
    await stop();
    await start();
    const me = await call('/api/me', undefined, student);
    assert.equal(me.data.progress.fields['about-me'].corrections.length, 1);
    assert.equal(me.data.progress.schemaVersion, 1);
    // Stored request budget and provider failures are tested independently without paid calls.
    const sessions = JSON.parse(fs.readFileSync(path.join(data, 'sessions.json')));
    sessions[student].created = 1;
    fs.writeFileSync(path.join(data, 'sessions.json'), JSON.stringify(sessions));
    assert.equal((await call('/api/me', undefined, student)).status, 401);
  } finally {
    await stop();
  }
});
test('standalone export escapes title and JS data', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-build-'));
  const c = JSON.parse(fs.readFileSync(path.join(root, 'demo-export.json')));
  c.pageTitle = '</title><meta name="bad">';
  c.slots['site-title'] = '</script><script>bad()</script>';
  const result = await builder.exportSite({
    rootDir: root,
    config: c,
    outPath: path.join(dir, 'test.html'),
  });
  const html = fs.readFileSync(result.outPath, 'utf8');
  assert(!html.includes('<meta name="bad">'));
  assert(html.includes('&lt;/title&gt;'));
  assert(html.includes('\\u003c/script>'));
  const points = await builder.sampleParticles({
    sourcePath: path.join(root, 'rehearsal/assets/lumi-avatar.png'),
    outPath: path.join(dir, 'particles.js'),
  });
  assert(points.length > 0 && points.every((p) => p[2] >= 0 && p[2] <= 255));
});
