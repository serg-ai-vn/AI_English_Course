'use strict';
// Explicit operator action only. Running without flags never contacts a provider.
async function main() {
  const args = process.argv.slice(2);
  if (!args.some((x) => x === '--text' || x === '--image')) {
    console.log(
      'Usage: npm run check:live -- --text [--image]. These flags make bounded paid AI calls. Requires configured key, models and DATA_DIR. No calls made.',
    );
    return;
  }
  require('../platform/settings');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing. No calls made.');
  process.env.AI_PROVIDER = 'openai';
  const path = require('path'),
    ai = require('../platform/ai-provider'),
    storage = require('../platform/storage'),
    data = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../platform/data'));
  ai.configure(data);
  if (args.includes('--text')) {
    const cfg = require('../platform/config/lesson-2.json'),
      def = cfg.fields.find((f) => f.id === 'about-me');
    await ai.text({
      fieldId: 'about-me',
      prompt:
        'Role: creative student. Context: I have drawn pictures for this project. Task: energetic introduction. Format: one paragraph.',
      stage: 1,
      cfg,
      def,
    });
    console.log(
      JSON.stringify({
        type: 'text',
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-6-luna',
        status: 'PASS',
      }),
    );
  }
  if (args.includes('--image')) {
    await ai.image({
      studentId: 'preflight',
      def: { id: 'avatar', spec: { width: 256, height: 256 } },
      prompt: 'A fictional round robot avatar, concept art, front view, soft light.',
      iteration: 1,
      dataDir: data,
    });
    console.log(
      JSON.stringify({
        type: 'image',
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst',
        quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
        status: 'PASS',
      }),
    );
  }
  const state = storage.readJson(path.join(data, 'ai-readiness.json'), {});
  console.log(
    JSON.stringify({
      readiness: ai.status(),
      usage: state.usageTotals || {},
      costEstimate:
        'NOT_CONFIGURED: compare usage with current official pricing; request caps are not dollar caps.',
    }),
  );
}
main().catch((e) => {
  console.error(
    JSON.stringify({
      status: 'FAIL',
      code: e.code || 'configuration',
      message: e.publicMessage || e.message,
    }),
  );
  process.exitCode = 1;
});
