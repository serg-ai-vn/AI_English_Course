'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  os = require('os'),
  path = require('path');
const ai = require('../platform/ai-provider'),
  v = require('../platform/validate');
test('live adapter: valid text, refusal, timeout, budget and image bytes without paid calls', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-ai-')),
    env = { ...process.env },
    originalFetch = global.fetch;
  let calls = 0;
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../platform/config/lesson-2.json'))),
    def = cfg.fields.find((f) => f.id === 'about-me');
  const prompt =
    'Role: creative student Context: I have played football for three years. Task: energetic introduction Format: paragraph';
  const draft = ai.mock('about-me', prompt);
  assert(v.checkText(def, draft, cfg).ok);
  try {
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_TEXT_REQUEST_LIMIT = '5';
    process.env.AI_IMAGE_REQUEST_LIMIT = '1';
    ai.configure(dir);
    global.fetch = async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({ output: [{ content: [{ type: 'output_text', text: draft }] }] }),
      };
    };
    assert.equal(await ai.text({ fieldId: 'about-me', prompt, cfg, def }), draft);
    assert.equal(calls, 1);
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ output: [{ content: [{ type: 'refusal', refusal: 'no' }] }] }),
    });
    await assert.rejects(ai.text({ fieldId: 'about-me', prompt, cfg, def }), /did not meet/);
    global.fetch = async () => {
      throw new Error('timeout');
    };
    await assert.rejects(ai.text({ fieldId: 'about-me', prompt, cfg, def }), /timeout/);
    global.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(ai.text({ fieldId: 'about-me', prompt, cfg, def }), /429/);
    await assert.rejects(ai.text({ fieldId: 'about-me', prompt, cfg, def }), /budget/);
    const png = fs
      .readFileSync(path.join(__dirname, '../rehearsal/assets/lumi-avatar.png'))
      .toString('base64');
    global.fetch = async () => ({ ok: true, json: async () => ({ data: [{ b64_json: png }] }) });
    const img = await ai.image({
      studentId: 'sample',
      def: { id: 'avatar', spec: { width: 256, height: 256 } },
      prompt: 'fictional drawing',
      iteration: 1,
      dataDir: dir,
    });
    assert(fs.existsSync(path.join(dir, img.path.slice(8))));
    await assert.rejects(
      ai.image({
        studentId: 'sample',
        def: { id: 'avatar' },
        prompt: 'drawing',
        iteration: 2,
        dataDir: dir,
      }),
      /budget/,
    );
  } finally {
    global.fetch = originalFetch;
    for (const k of Object.keys(process.env)) if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env);
  }
});
