const test = require('node:test');
const assert = require('node:assert/strict');
const points = require('../platform/points');
const defs = [2, 3, 4, 5].flatMap((lesson) =>
  require('../platform/config/lesson-' + lesson + '.json').fields.map((f) => ({ ...f, lesson })),
);
const version = {
  prompt: 'a prompt',
  draft: 'a draft',
  image: { path: 'image.png' },
  good: 'clear',
  needsChange: 'style',
  pros: 'good',
  cons: 'weak',
  best: { reason: 'appropriate' },
  worst: { reason: 'too dark' },
  edited: 'edited',
  reason: 'change',
};
const state = {
  status: 'done',
  value: 'Saved work',
  iterations: Array(6).fill(version),
  items: { data: true, hallucination: true },
  option1: { preset: 'a' },
  option2: { preset: 'b' },
  choice: 1,
  justification: 'a softer palette',
};
test('step totals, first vs sixth attempt, stable history and feature switch', () => {
  const p = { fields: {} };
  for (const def of defs) {
    p.fields[def.id] = structuredClone(state);
    points.record(p, def, null);
    points.record(p, def, null);
  }
  const totals = [2, 3, 4, 5].map((n) =>
    points.sum(points.events(p).filter((e) => e.lesson === n)),
  );
  assert.deepEqual(totals, [78, 65, 40, 45]);
  const core = points
    .events(p)
    .filter(
      (e) =>
        !['footer-text', 'background'].includes(e.field) &&
        !e.field.startsWith('hobby-image') &&
        e.type !== 'hobbyBonus',
    );
  assert.equal(points.sum(core), 177);
  const def = defs.find((f) => f.id === 'background');
  const one = { fields: { background: { ...state, iterations: [version] } } };
  points.seed(one);
  points.seed(one);
  assert.equal(points.sum(points.events(one)), 10);
  assert.equal(points.sum(points.events(p).filter((e) => e.field === 'background')), 10);
  const footer = defs.find((f) => f.id === 'footer-text');
  const old = { fields: { 'footer-text': { status: 'done', value: '' } } };
  points.record(old, footer, null);
  assert.equal(points.sum(points.events(old)), 0);
  const oldPrice = points.rules.steps.imageFinal.pts;
  try {
    points.rules.steps.imageFinal.pts = 70;
    points.seed(one);
    assert.equal(points.sum(points.events(one)), 10);
    points.rules.enabled = false;
    const fresh = { fields: { background: state } };
    points.seed(fresh);
    assert.equal(points.events(fresh).length, 0);
    assert.throws(() => points.manual(fresh, {}));
  } finally {
    points.rules.steps.imageFinal.pts = oldPrice;
    points.rules.enabled = true;
  }
});
test('manual award retries, cap, revoke exactly once and released allowance', () => {
  const p = {};
  const b = { lesson: 1, kind: 'explanation', requestId: 'request-1' };
  for (let i = 1; i <= 4; i++) points.manual(p, { ...b, requestId: 'request-' + i });
  assert.equal(points.manual(p, b), 'Already recorded');
  assert.match(points.manual(p, { ...b, requestId: 'request-5' }), /Skipped/);
  const revoke = {
    ...b,
    kind: 'revoke',
    revokes: 'teacher:request-1',
    reason: 'Duplicate activity',
    requestId: 'revoke-01',
  };
  points.manual(p, revoke);
  assert.throws(() => points.manual(p, { ...revoke, requestId: 'revoke-02' }));
  assert.equal(points.manual(p, { ...b, requestId: 'request-6' }), 'Awarded');
  assert.equal(points.sum(points.events(p)), 20);
});

test('batch replay and per-lesson net cap with unequal starting balances', () => {
  const a = {},
    b = {};
  const base = { kind: 'helper', lesson: 3 };
  for (let i = 0; i < 4; i++) points.manual(a, { ...base, requestId: 'personal-' + i });
  const group = { ...base, requestId: 'group-0001' };
  assert.match(points.manual(a, group), /Skipped/);
  assert.equal(points.manual(b, group), 'Awarded');
  assert.equal(points.manual(b, group), 'Already recorded');
  assert.equal(points.sum(points.events(a)), 20);
  assert.equal(points.sum(points.events(b)), 5);
});
