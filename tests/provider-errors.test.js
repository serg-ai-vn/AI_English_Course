'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  os = require('os'),
  path = require('path'),
  sharp = require('sharp'),
  ai = require('../platform/ai-provider'),
  v = require('../platform/validate');
const cfg = require('../platform/config/lesson-2.json'),
  about = cfg.fields.find((f) => f.id === 'about-me'),
  hobby = cfg.fields.find((f) => f.id === 'hobby-text-1');
test('demo: short context and grammar outside Context produce valid text; overlong context gives actionable 422', async () => {
  for (const def of [about, hobby])
    for (const context of ['I like art', 'I have played chess for years']) {
      const prompt =
        'Role: a creative student. Context: ' +
        context +
        '. Task: I have played an energetic game. Format: paragraph.';
      const text = ai.mock(def.id, prompt);
      assert(v.checkText(def, text, cfg).ok, text);
    }
  const original = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'mock';
  try {
    await assert.rejects(
      ai.text({
        fieldId: hobby.id,
        prompt: 'Context: ' + 'one '.repeat(100) + ' Task: write',
        cfg,
        def: hobby,
      }),
      (e) => e.status === 422 && e.code === 'demo_context',
    );
  } finally {
    if (original === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = original;
  }
});
test('live errors classified and redacted; invalid text bounded to two requests; explicit image parameters and opaque RGBA rejection', async () => {
  const env = { ...process.env },
    fetchOriginal = global.fetch,
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-provider-'));
  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-secret-never-log';
  process.env.AI_TEXT_REQUEST_LIMIT = '30';
  process.env.AI_IMAGE_REQUEST_LIMIT = '10';
  ai.configure(dir);
  const input = {
    fieldId: about.id,
    prompt:
      'Role: student Context: I have drawn pictures. Task: energetic creative introduction Format: paragraph',
    cfg,
    def: about,
  };
  try {
    for (const [http, code] of [
      [401, 'provider_access'],
      [403, 'provider_access'],
      [404, 'provider_model_unavailable'],
      [429, 'provider_rate_limit'],
    ]) {
      global.fetch = async () => ({ ok: false, status: http });
      await assert.rejects(ai.text(input), (e) => {
        assert.equal(e.status, 503);
        assert.equal(e.code, code);
        assert(!e.message.includes(process.env.OPENAI_API_KEY));
        return true;
      });
    }
    for (const malformed of [
      { output: {} },
      { output: [null] },
      { output: [{ content: {} }] },
      { output: [{ content: [null] }] },
      { output: [{ content: [{ type: 'output_text', text: {} }] }] },
    ]) {
      let attempts = 0;
      global.fetch = async () => {
        attempts++;
        return { ok: true, json: async () => malformed };
      };
      await assert.rejects(
        ai.text(input),
        (e) => e.status === 502 && e.code === 'provider_invalid_response',
      );
      assert.equal(attempts, 1);
    }
    let calls = 0;
    global.fetch = async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          output: [{ content: [{ type: 'output_text', text: 'too short' }] }],
          usage: { input_tokens: 3, output_tokens: 4 },
        }),
      };
    };
    await assert.rejects(
      ai.text(input),
      (e) => e.code === 'provider_invalid_output' && e.status === 502,
    );
    assert.equal(calls, 2);
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        output: [{ content: [{ type: 'output_text', text: ai.mock(about.id, input.prompt) }] }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    await ai.text(input);
    assert.equal(ai.status().readiness.text, true);
    const totals = JSON.parse(fs.readFileSync(path.join(dir, 'ai-readiness.json'))).usageTotals
      .text;
    assert.equal(totals.calls, 3);
    assert.equal(totals.input_tokens, 16);
    assert.equal(totals.output_tokens, 28);
    assert.equal(ai.status().liveChecked, false);
    const png = fs
      .readFileSync(path.join(__dirname, '../rehearsal/assets/lumi-avatar.png'))
      .toString('base64');
    let payload;
    global.fetch = async (url, opts) => {
      payload = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({ data: [{ b64_json: png }], usage: { total_tokens: 50 } }),
      };
    };
    const imageInput = {
      studentId: 'fixture',
      def: { id: 'avatar', spec: { width: 256, height: 256 } },
      prompt: 'fictional robot',
      iteration: 1,
      dataDir: dir,
    };
    await ai.image(imageInput);
    assert.equal(payload.n, 1);
    assert.equal(payload.quality, 'medium');
    assert.equal(payload.output_format, 'png');
    assert.equal(payload.background, 'transparent');
    assert.equal(ai.status().liveChecked, true);
    const opaque = (
      await sharp({
        create: { width: 8, height: 8, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } },
      })
        .png()
        .toBuffer()
    ).toString('base64');
    global.fetch = async () => ({ ok: true, json: async () => ({ data: [{ b64_json: opaque }] }) });
    await assert.rejects(
      ai.image(imageInput),
      (e) => e.code === 'provider_invalid_image' && e.status === 502,
    );
    assert.equal(ai.status().liveChecked, false);
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        output: [{ content: [{ type: 'output_text', text: ai.mock(about.id, input.prompt) }] }],
      }),
    });
    await ai.text(input);
    assert.equal(
      ai.status().liveChecked,
      false,
      'A new text success must not clear an outstanding image failure',
    );
    assert(
      !fs
        .readFileSync(path.join(dir, 'ai-readiness.json'), 'utf8')
        .includes('test-secret-never-log'),
    );
  } finally {
    global.fetch = fetchOriginal;
    for (const k of Object.keys(process.env)) if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env);
  }
});
