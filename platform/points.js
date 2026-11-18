'use strict';
const rules = require('./config/points.json');
const lessons = [2, 3, 4, 5].map((n) => require('./config/lesson-' + n + '.json'));
const events = (p) => p.points?.events || [];
const sum = (rows) => rows.reduce((total, e) => total + e.pts, 0);

function milestones(def, field) {
  const steps = [];
  if (!field) return steps;
  function add(type, condition, ref = 1) {
    if (condition)
      steps.push({
        id: [type, def.id, ref].join(':'),
        type,
        ref,
        field: def.id,
        lesson: def.lesson,
      });
  }
  const done = field.status === 'done';
  const versions = field.iterations || [];
  switch (def.input) {
    case 'direct':
      add(def.id.startsWith('reflection-') ? 'reflection' : 'direct', done && field.value?.trim());
      break;
    case 'checklist':
      add('audit', done && field.items?.data && field.items?.hallucination);
      break;
    case 'ai-text-3step':
      versions.slice(0, 2).forEach((v, i) => {
        add(i ? 'aboutRevised' : 'aboutPrompt', v.prompt && v.draft);
        add('review', v.good && v.needsChange, i + 1);
      });
      add('aboutFinal', done && field.value);
      break;
    case 'ai-cycle-bonus':
      add('hobbyPrompt', versions[0]?.prompt && versions[0]?.draft);
      add('hobbyFinal', done && field.value);
      add('hobbyBonus', done && versions[0]?.edited && versions[0]?.reason);
      break;
    case 'ai-image-cycle':
      versions.slice(0, rules.avatarVersions).forEach((v, i) => {
        add('avatarPrompt', v.prompt && v.image?.path, i + 1);
        add('avatarReview', v.pros && v.cons, i + 1);
      });
      add(
        'best',
        versions.some((v) => v.best?.reason),
      );
      add(
        'worst',
        versions.some((v) => v.worst?.reason),
      );
      add('avatarFinal', done && field.value);
      break;
    case 'ai-image-rapid':
      add('imagePrompt', versions[0]?.prompt && versions[0]?.image?.path);
      add('imageFinal', done && field.value);
      break;
    case 'theme-picker':
      add('themeOption', field.option1?.preset, 1);
      add('themeOption', field.option2?.preset, 2);
      add('choice', field.choice);
      add('justify', done && field.justification);
      break;
  }
  return steps;
}

function record(p, def, before, source = 'auto') {
  if (!rules.enabled) return;
  const seen = new Set([...events(p), ...milestones(def, before)].map((e) => e.id));
  for (const e of milestones(def, p.fields[def.id])) {
    if (seen.has(e.id)) continue;
    const price = rules.steps[e.type];
    (p.points ||= { events: [] }).events.push({
      ...e,
      source,
      at: Date.now(),
      rulesVersion: rules.version,
      pts: price.pts,
      label: e.type === 'direct' ? def.label + ' ' + price.label.toLowerCase() : price.label,
    });
  }
}

function seed(p) {
  for (const lesson of lessons)
    for (const field of lesson.fields)
      record(p, { ...field, lesson: lesson.lesson }, null, 'backfill');
}

function manual(p, body) {
  const { lesson, requestId, kind } = body;
  if (
    !rules.enabled ||
    !Number.isInteger(lesson) ||
    lesson < 1 ||
    lesson > 5 ||
    typeof requestId !== 'string' ||
    !/^[a-zA-Z0-9-]{8,80}$/.test(requestId)
  )
    throw Error('Choose a lesson and a valid award request.');
  const id = 'teacher:' + requestId;
  const log = events(p);
  if (log.some((e) => e.id === id)) return 'Already recorded';
  const reason = String(body.reason || '')
    .trim()
    .slice(0, 300);
  let pts, label;
  if (kind === 'revoke') {
    const prior = log.find(
      (e) => e.id === body.revokes && e.source === 'teacher' && e.pts > 0 && e.lesson === lesson,
    );
    if (!prior || !reason || log.some((e) => e.revokes === prior.id))
      throw Error('Choose an active award and give a reason.');
    pts = -prior.pts;
    label = 'Award revoked';
  } else {
    const preset = Object.hasOwn(rules.presets, kind) && rules.presets[kind];
    pts = preset ? preset.pts : body.amount;
    label = preset ? preset.label : 'Teacher award';
    if (
      !preset &&
      (kind !== 'custom' || !Number.isInteger(pts) || pts < 1 || pts > rules.customMax || !reason)
    )
      throw Error('Choose a preset or a custom amount and reason.');
    if (
      sum(log.filter((e) => e.lesson === lesson && e.source === 'teacher')) + pts >
      rules.manualCap
    )
      return 'Skipped: lesson limit';
  }
  (p.points ||= { events: [] }).events.push({
    id,
    source: 'teacher',
    type: kind,
    lesson,
    pts,
    label,
    reason,
    at: Date.now(),
    rulesVersion: rules.version,
    ...(kind === 'revoke' ? { revokes: body.revokes } : {}),
  });
  return kind === 'revoke' ? 'Revoked' : 'Awarded';
}
module.exports = { rules, events, sum, record, manual, seed };
